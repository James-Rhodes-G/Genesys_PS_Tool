import { genesysRequest, buildGenesysApiUrl, getGenesysDomainForRegion } from "./genesys.js";
import { runGenesysHttp } from "./genesys-rate-limit.js";

const MAX_EXECUTION_DOCUMENT_BYTES = Number(process.env.FLOW_EXECUTION_MAX_BYTES || 52_428_800);
const EXECUTION_FETCH_TIMEOUT_MS = Number(process.env.FLOW_EXECUTION_FETCH_TIMEOUT_MS || 60_000);
const MAX_EXECUTION_REDIRECTS = 5;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const COMPLETE_STATUSES = new Set(["succeeded", "complete", "completed", "success"]);
const FAILED_STATUSES = new Set(["failed", "cancelled", "canceled", "error"]);

const pickDownloadUri = (payload) => {
  const direct =
    payload?.downloadURI || payload?.downloadUri || payload?.downloadUrl || payload?.uri || null;
  if (direct) {
    return direct;
  }

  const entities = Array.isArray(payload?.entities) ? payload.entities : [];
  for (const entity of entities) {
    if (entity?.failed) {
      continue;
    }

    const uri = entity?.downloadURI || entity?.downloadUri || entity?.downloadUrl || entity?.uri || null;
    if (uri) {
      return uri;
    }
  }

  return null;
};

const pickJobId = (payload) => payload?.id || payload?.jobId || null;

const pickJobStatus = (payload) =>
  String(payload?.jobState || payload?.status || payload?.state || "").toLowerCase();

const pickEntityFailure = (payload) => {
  const entities = Array.isArray(payload?.entities) ? payload.entities : [];
  return entities.find((entity) => entity?.failed) || null;
};

const extractDownloadId = (downloadUri) => {
  const match = String(downloadUri || "").match(/\/downloads\/([^/?]+)/i);
  return match?.[1] || null;
};

const startFlowExecutionDownloadJob = async ({ region, token, instanceId }) =>
  genesysRequest({
    region,
    token,
    method: "GET",
    path: `/api/v2/flows/instances/${encodeURIComponent(instanceId)}`,
  });

const getFlowExecutionDownloadJob = async ({ region, token, jobId }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/flows/instances/jobs/${encodeURIComponent(jobId)}`,
  });

const resolveSignedDownloadUrl = async ({ region, token, downloadUri }) => {
  const downloadId = extractDownloadId(downloadUri);
  if (!downloadId) {
    throw new Error("Unable to resolve download ID from Genesys download URI.");
  }

  const payload = await genesysRequest({
    region,
    token,
    path: `/api/v2/downloads/${encodeURIComponent(downloadId)}?issueRedirect=false`,
  });

  return payload?.url || payload?.uri || downloadUri;
};

const parseJsonDocument = (text) => {
  const trimmed = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    throw new Error("Downloaded flow execution document is empty.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error("Downloaded flow execution document is not valid JSON.");
  }
};

const summarizeDocument = (document, byteLength = null) => {
  if (document == null) {
    return { topLevelKeys: [], byteLength: byteLength ?? 0, type: typeof document };
  }

  const resolvedByteLength =
    byteLength ??
    (() => {
      try {
        return JSON.stringify(document).length;
      } catch {
        return 0;
      }
    })();

  if (Array.isArray(document)) {
    return {
      topLevelKeys: ["[]"],
      byteLength: resolvedByteLength,
      type: "array",
      length: document.length,
    };
  }

  if (typeof document === "object") {
    return {
      topLevelKeys: Object.keys(document),
      byteLength: resolvedByteLength,
      type: "object",
    };
  }

  return { topLevelKeys: [], byteLength: resolvedByteLength, type: typeof document };
};

const isAllowedExecutionHost = (hostname, genesysDomain) => {
  const host = String(hostname || "").toLowerCase();
  const domain = String(genesysDomain || "").toLowerCase();
  if (!host || !domain) {
    return false;
  }
  return (
    host === domain ||
    host.endsWith(`.${domain}`) ||
    host.endsWith(".mypurecloud.com") ||
    host.endsWith(".pure.cloud") ||
    host.endsWith(".inindca.com")
  );
};

const fetchExecutionDocument = async ({ region, token, downloadUri }) => {
  let requestUrl = String(downloadUri || "").trim();
  if (!requestUrl) {
    throw new Error("Flow execution download URI is missing.");
  }

  const headers = {
    Accept: "application/json, application/octet-stream, text/plain, */*",
    "User-Agent": "PS-Tool/1.0",
  };

  if (!requestUrl.startsWith("http")) {
    const signedUrl = await resolveSignedDownloadUrl({ region, token, downloadUri });
    const apiUrl = await buildGenesysApiUrl(region, "/");
    requestUrl = signedUrl.startsWith("http") ? signedUrl : `${apiUrl}${signedUrl.replace(/^\//, "")}`;
    headers.Authorization = `Bearer ${token}`;
  }

  const genesysDomain = await getGenesysDomainForRegion(region);
  let currentUrl;
  try {
    currentUrl = new URL(requestUrl);
  } catch {
    throw new Error("Flow execution download URI is invalid.");
  }

  if (currentUrl.protocol !== "https:" || !isAllowedExecutionHost(currentUrl.hostname, genesysDomain)) {
    throw new Error("Flow execution download host is not allowed.");
  }

  let requestHost = currentUrl.host;
  console.log("[flow-execution] fetching rendered execution document", {
    host: requestHost,
  });

  let redirectCount = 0;
  let response;
  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXECUTION_FETCH_TIMEOUT_MS);
    try {
      response = await runGenesysHttp(
        () => fetch(currentUrl, { headers, redirect: "manual", signal: controller.signal }),
        { host: requestHost, kind: "flow-execution-download" }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount >= MAX_EXECUTION_REDIRECTS) {
        throw new Error("Flow execution download redirect limit exceeded.");
      }
      redirectCount += 1;
      currentUrl = new URL(location, currentUrl);
      if (currentUrl.protocol !== "https:" || !isAllowedExecutionHost(currentUrl.hostname, genesysDomain)) {
        throw new Error("Flow execution download redirect target is not allowed.");
      }
      requestHost = currentUrl.host;
      continue;
    }
    break;
  }

  const reader = response.body?.getReader?.();
  let text = "";
  if (reader) {
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > MAX_EXECUTION_DOCUMENT_BYTES) {
        throw new Error("Flow execution document exceeds size limit.");
      }
      chunks.push(value);
    }
    text = Buffer.concat(chunks).toString("utf8");
  } else {
    text = await response.text();
    if (text.length > MAX_EXECUTION_DOCUMENT_BYTES) {
      throw new Error("Flow execution document exceeds size limit.");
    }
  }
  console.log("[flow-execution] rendered execution document response", {
    host: requestHost,
    status: response.status,
    contentType: response.headers.get("content-type"),
    byteLength: text.length,
  });

  if (!response.ok) {
    throw new Error(`Flow execution download failed with ${response.status}.`);
  }

  const document = parseJsonDocument(text);
  const meta = summarizeDocument(document, text.length);
  console.log("[flow-execution] rendered execution document parsed", meta);

  return { document, meta };
};

const pollFlowExecutionDownloadJob = async ({
  region,
  token,
  instanceId,
  initialJob,
  onStatus,
  maxAttempts = 120,
  intervalMs = 2000,
}) => {
  let job = initialJob;
  let jobId = pickJobId(job);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    onStatus?.(job);

    const failedEntity = pickEntityFailure(job);
    if (failedEntity) {
      throw new Error(
        failedEntity?.error || failedEntity?.message || "Flow execution download failed for one or more instances."
      );
    }

    const downloadUri = pickDownloadUri(job);
    const status = pickJobStatus(job);

    if (downloadUri && COMPLETE_STATUSES.has(status)) {
      return { job, downloadUri };
    }

    if (FAILED_STATUSES.has(status)) {
      throw new Error(job?.error || job?.message || `Flow execution download ${status}.`);
    }

    await wait(intervalMs);

    job = jobId
      ? await getFlowExecutionDownloadJob({ region, token, jobId })
      : await startFlowExecutionDownloadJob({ region, token, instanceId });

    jobId = pickJobId(job) || jobId;
  }

  throw new Error("Timed out waiting for flow execution download.");
};

const downloadFlowExecutionJson = async ({ region, token, instanceId, onStatus }) => {
  const initialJob = await startFlowExecutionDownloadJob({ region, token, instanceId });
  const { downloadUri } = await pollFlowExecutionDownloadJob({
    region,
    token,
    instanceId,
    initialJob,
    onStatus,
  });

  const { document, meta } = await fetchExecutionDocument({ region, token, downloadUri });
  return { document, downloadMeta: { ...meta, downloadUriHost: (() => {
    try {
      return new URL(downloadUri).host;
    } catch {
      return null;
    }
  })() } };
};

export {
  COMPLETE_STATUSES,
  downloadFlowExecutionJson,
  extractDownloadId,
  fetchExecutionDocument,
  getFlowExecutionDownloadJob,
  pickDownloadUri,
  pickJobStatus,
  pollFlowExecutionDownloadJob,
  resolveSignedDownloadUrl,
  startFlowExecutionDownloadJob,
};
