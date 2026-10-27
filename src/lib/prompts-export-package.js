import dns from "dns";
import net from "net";
import { promisify } from "util";
import JSZip from "jszip";
import { createWorkerPool } from "./concurrency/worker-pool.js";

const dnsLookup = promisify(dns.lookup);
const RECORDING_DOWNLOAD_CONCURRENCY = 4;
const MAX_RECORDINGS_PER_REQUEST = Number(process.env.PROMPT_EXPORT_MAX_RECORDINGS || 500);
const MAX_RECORDING_BYTES = Number(process.env.PROMPT_EXPORT_MAX_RECORDING_BYTES || 52_428_800);
const FETCH_TIMEOUT_MS = Number(process.env.PROMPT_EXPORT_FETCH_TIMEOUT_MS || 60_000);
const MAX_REDIRECTS = 5;

const isRetryableDownloadError = (error) => {
  const status = Number(error?.status);
  return status === 429 || (status >= 500 && status <= 504);
};

const isPrivateOrLocalAddress = (address) => {
  const normalized = String(address || "").trim();
  if (!normalized) {
    return true;
  }
  if (net.isIP(normalized)) {
    return net.isIP(normalized) !== 0 && !normalized.startsWith("0.");
  }
  const lower = normalized.toLowerCase();
  return (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local")
  );
};

const isPrivateIp = (ip) => {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
  }
  return true;
};

const resolveHostname = async (hostname) => {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host || isPrivateOrLocalAddress(host)) {
    throw new Error("Recording host is not allowed.");
  }
  const { address } = await dnsLookup(host, { verbatim: true });
  if (isPrivateIp(address)) {
    throw new Error("Recording host resolves to a private address.");
  }
  return address;
};

/**
 * Media URIs come from the browser request body; only https URLs on public hosts are fetched.
 */
const parseRecordingUri = (mediaUri) => {
  let url;
  try {
    url = new URL(String(mediaUri || "").trim());
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    net.isIP(hostname.replace(/^\[|\]$/g, "")) ||
    !hostname.includes(".") ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost")
  ) {
    return null;
  }

  return url;
};

/** The Genesys bearer token is only sent to hosts under the org's Genesys domain. */
const isGenesysHost = (hostname, genesysDomain) => {
  const domain = String(genesysDomain || "").trim().toLowerCase();
  const host = String(hostname || "").toLowerCase();
  return Boolean(domain) && (host === domain || host.endsWith(`.${domain}`));
};

/** ZIP entries are flat files; strip path separators so extraction cannot escape the target folder. */
const toFlatFilename = (value) => String(value || "").trim().replace(/[\\/]+/g, "_");

const fetchWithTimeout = async (url, options) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const readResponseWithLimit = async (response) => {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RECORDING_BYTES) {
      throw new Error("Recording exceeds size limit.");
    }
    return buffer;
  }

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > MAX_RECORDING_BYTES) {
      throw new Error("Recording exceeds size limit.");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
};

const fetchRecording = async ({ url, token, genesysDomain }) => {
  if (process.env.PROMPT_EXPORT_SKIP_DNS !== "1") {
    await resolveHostname(url.hostname);
  }

  let currentUrl = url;
  let redirectCount = 0;
  const headers = {};
  if (token && isGenesysHost(currentUrl.hostname, genesysDomain)) {
    headers.Authorization = `Bearer ${token}`;
  }

  while (true) {
    const response = await fetchWithTimeout(currentUrl, { headers, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount >= MAX_REDIRECTS) {
        throw new Error("Too many redirects while fetching recording.");
      }
      redirectCount += 1;
      currentUrl = new URL(location, currentUrl);
      const parsed = parseRecordingUri(currentUrl.toString());
      if (!parsed) {
        throw new Error("Recording redirect target is not allowed.");
      }
      if (process.env.PROMPT_EXPORT_SKIP_DNS !== "1") {
        await resolveHostname(parsed.hostname);
      }
      currentUrl = parsed;
      continue;
    }

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return readResponseWithLimit(response);
  }
};

const buildPromptExportZip = async ({
  mode,
  recordings = [],
  importCsvText,
  importCsvFilename,
  token,
  genesysDomain,
}) => {
  if (mode === "recordings-only" && recordings.length === 0) {
    throw new Error("No prompt recordings to export.");
  }

  if (recordings.length > MAX_RECORDINGS_PER_REQUEST) {
    throw new Error(`Cannot export more than ${MAX_RECORDINGS_PER_REQUEST} recordings at once.`);
  }

  const zip = new JSZip();

  if (mode === "import-package" && importCsvText) {
    zip.file(toFlatFilename(importCsvFilename) || "prompts_bulk_import.csv", importCsvText);
  }

  const items = recordings.map((entry, index) => ({
    itemId: String(index),
    filename: toFlatFilename(entry?.filename),
    url: parseRecordingUri(entry?.mediaUri),
  }));

  const pool = createWorkerPool({ defaultConcurrency: RECORDING_DOWNLOAD_CONCURRENCY, defaultMaxRetries: 2 });
  const { results } = await pool.process(
    items,
    async (item) => {
      if (!item.filename || !item.url) {
        throw new Error("Invalid recording entry");
      }

      zip.file(item.filename, await fetchRecording({ url: item.url, token, genesysDomain }));
    },
    { isRetryable: isRetryableDownloadError }
  );

  const failures = results
    .filter((result) => result.status === "failed")
    .map((result) => ({ filename: items[Number(result.itemId)].filename, error: result.error }));

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  return {
    zipBuffer,
    successCount: items.length - failures.length,
    failures,
  };
};

export { buildPromptExportZip, isGenesysHost, parseRecordingUri };
