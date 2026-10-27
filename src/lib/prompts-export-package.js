import net from "net";
import JSZip from "jszip";
import { createWorkerPool } from "./concurrency/worker-pool.js";

const RECORDING_DOWNLOAD_CONCURRENCY = 4;

const isRetryableDownloadError = (error) => {
  const status = Number(error?.status);
  return status === 429 || (status >= 500 && status <= 504);
};

/**
 * Media URIs come from the browser request body, so only plain public https hosts are fetched
 * (no IP literals, localhost, or single-label hosts).
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

const fetchRecording = async ({ url, token, genesysDomain }) => {
  const headers = {};
  if (token && isGenesysHost(url.hostname, genesysDomain)) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.arrayBuffer();
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
