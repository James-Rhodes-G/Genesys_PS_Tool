/**
 * Mock API limits and lifecycle defaults. Override via environment variables.
 */
const readInt = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const MOCK_API_CONFIG = {
  maxResponseBodyBytes: readInt("MOCK_API_MAX_RESPONSE_BODY_BYTES", 262144),
  maxRequestBodyBytes: readInt("MOCK_API_MAX_REQUEST_BODY_BYTES", 262144),
  maxHeaders: readInt("MOCK_API_MAX_HEADERS", 20),
  maxHeaderValueBytes: readInt("MOCK_API_MAX_HEADER_VALUE_BYTES", 2048),
  maxEndpointsPerUser: readInt("MOCK_API_MAX_ENDPOINTS_PER_USER", 25),
  maxRequestLogsPerEndpoint: readInt("MOCK_API_MAX_REQUEST_LOGS_PER_ENDPOINT", 1000),
  inactivityMs: readInt("MOCK_API_INACTIVITY_MS", 2 * 60 * 60 * 1000),
  maxLifetimeMs: readInt("MOCK_API_MAX_LIFETIME_MS", 24 * 60 * 60 * 1000),
  retentionExpiredMs: readInt("MOCK_API_RETENTION_EXPIRED_MS", 7 * 24 * 60 * 60 * 1000),
  purgeIntervalMs: readInt("MOCK_API_PURGE_INTERVAL_MS", 60 * 60 * 1000),
  maxDelayMs: readInt("MOCK_API_MAX_DELAY_MS", 30 * 1000),
  allowedDelaysMs: [0, 250, 500, 1000, 2000, 5000, 10000, 30000],
  reservedSlugs: new Set(["admin", "logs", "archive", "internal"]),
  allowedMethods: new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
  allowedContentTypes: new Set([
    "application/json",
    "text/plain",
    "text/html",
    "application/xml",
  ]),
};

export { MOCK_API_CONFIG };
