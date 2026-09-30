import { log } from "../structured-log.js";
import { buildGenesysApiUrl, normalizeHeaders } from "../genesys.js";
import { getGenesysHttpMetrics, runGenesysHttp } from "../genesys-rate-limit.js";

const parseResponseBody = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const getCorrelationId = (response) =>
  response?.headers?.get?.("inin-correlation-id") ||
  response?.headers?.get?.("x-correlation-id") ||
  null;

const createGenesysApiError = (response, data) => {
  const message = data?.message || data?.error || `Genesys request failed with ${response.status}`;
  const error = new Error(message);
  error.status = response.status;
  error.details = data;
  error.retryable = response.status === 401 || response.status === 429 || [500, 502, 503, 504].includes(response.status);

  const retryAfterMs = response.headers?.get?.("retry-after");
  if (retryAfterMs) {
    const asSeconds = Number(retryAfterMs);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
      error.retryAfterMs = asSeconds * 1000;
    }
  }

  return error;
};

const createGenesysApiClient = ({
  tokenManager,
  region,
  logger = log,
  jobId = null,
  itemId = null,
  workerId = null,
} = {}) => {
  if (!tokenManager) {
    throw new Error("tokenManager is required");
  }

  const resolvedRegion = region || tokenManager.getRegion?.();

  const request = async ({ path, method = "GET", headers = {}, body, itemContext = {} }) => {
    const activeJobId = itemContext.jobId ?? jobId;
    const activeItemId = itemContext.itemId ?? itemId;
    const activeWorkerId = itemContext.workerId ?? workerId;
    const startedAt = Date.now();

    const url = await buildGenesysApiUrl(resolvedRegion, path);

    const response = await runGenesysHttp(
      async () => {
        const token = await tokenManager.getToken();
        const requestHeaders = normalizeHeaders(headers);
        requestHeaders.set("Authorization", `Bearer ${token}`);

        return fetch(url, {
          method,
          headers: requestHeaders,
          body: body == null ? undefined : JSON.stringify(body),
        });
      },
      {
        method,
        region: resolvedRegion,
        url,
        jobId: activeJobId,
        itemId: activeItemId,
        workerId: activeWorkerId,
        tokenManager,
      }
    );

    const durationMs = Date.now() - startedAt;
    const correlationId = getCorrelationId(response);

    logger("debug", "api_request", {
      jobId: activeJobId,
      itemId: activeItemId,
      workerId: activeWorkerId,
      method,
      path,
      httpStatus: response.status,
      durationMs,
      correlationId,
    });

    const data = await parseResponseBody(response);

    if (!response.ok) {
      logger("warn", "item_failed", {
        jobId: activeJobId,
        itemId: activeItemId,
        workerId: activeWorkerId,
        method,
        path,
        httpStatus: response.status,
        durationMs,
        correlationId,
      });
      throw createGenesysApiError(response, data);
    }

    return data;
  };

  return {
    get: (path, options = {}) => request({ ...options, path, method: "GET" }),
    post: (path, body, options = {}) => request({ ...options, path, method: "POST", body }),
    put: (path, body, options = {}) => request({ ...options, path, method: "PUT", body }),
    patch: (path, body, options = {}) => request({ ...options, path, method: "PATCH", body }),
    delete: (path, options = {}) => request({ ...options, path, method: "DELETE" }),
    getMetrics: () => getGenesysHttpMetrics(),
  };
};

export { createGenesysApiClient, createGenesysApiError };
