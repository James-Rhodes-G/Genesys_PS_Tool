import crypto from "crypto";

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || "info"] ?? LOG_LEVELS.info;

const redactKeys = new Set(["token", "password", "encrypted_token", "encryptedToken", "authorization"]);

const redactValue = (key, value) => {
  if (redactKeys.has(String(key).toLowerCase()) || String(key).toLowerCase().includes("token")) {
    return "[REDACTED]";
  }
  return value;
};

const log = (level, message, meta = {}) => {
  if (LOG_LEVELS[level] > currentLevel) return;
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...Object.fromEntries(
      Object.entries(meta).map(([k, v]) => [k, redactKeys.has(k) ? "[REDACTED]" : v])
    ),
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
};

const createRequestIdMiddleware = () => (req, res, next) => {
  const requestId = req.get("x-request-id") || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
};

const createRequestLoggerMiddleware = () => (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (!req.path.startsWith("/api/") && req.path !== "/health" && req.path !== "/ready") {
      return;
    }
    log("info", "request", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      sessionId: req.sessionId?.slice(0, 8),
    });
  });
  next();
};

export { log, createRequestIdMiddleware, createRequestLoggerMiddleware, redactValue };
