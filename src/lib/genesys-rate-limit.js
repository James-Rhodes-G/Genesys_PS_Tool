const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const parseNonNegativeIntEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
};

const getGenesysApiConcurrency = () => parsePositiveInt(process.env.GENESYS_API_CONCURRENCY, 4);
const getMaxHttpRetries = () => parseNonNegativeIntEnv(process.env.MAX_HTTP_RETRIES, 5);
const getRetryBaseDelayMs = () => parsePositiveInt(process.env.RETRY_BASE_DELAY_MS, 1000);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseNonNegativeInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const GENESYS_MIN_REQUEST_INTERVAL_MS = parseNonNegativeInt(
  process.env.GENESYS_MIN_REQUEST_INTERVAL_MS,
  250
);
const GENESYS_RATE_LIMIT_FALLBACK_MAX_DELAY_MS = parseNonNegativeInt(
  process.env.GENESYS_RATE_LIMIT_MAX_DELAY_MS,
  30000
);

const TRANSIENT_STATUS_CODES = new Set([500, 502, 503, 504]);

let nextRequestAt = 0;
let activeSlots = 0;
let waitQueue = [];

const httpMetrics = {
  rateLimit429Count: 0,
  requestCount: 0,
  totalRequestDurationMs: 0,
  retryCount: 0,
};

const resetGenesysRequestScheduler = () => {
  nextRequestAt = 0;
  activeSlots = 0;
  waitQueue = [];
  httpMetrics.rateLimit429Count = 0;
  httpMetrics.requestCount = 0;
  httpMetrics.totalRequestDurationMs = 0;
  httpMetrics.retryCount = 0;
};

const getGenesysHttpMetrics = () => ({ ...httpMetrics });

const waitUntilAllowed = async () => {
  const waitMs = Math.max(0, nextRequestAt - Date.now());
  if (waitMs > 0) {
    await wait(waitMs);
  }
};

const applyRateLimitBackoff = async (delayMs, context = {}) => {
  const safeDelayMs = Math.max(0, Number(delayMs) || 0);
  const resumeAt = Date.now() + safeDelayMs;

  if (resumeAt > nextRequestAt) {
    nextRequestAt = resumeAt;
  }

  if (safeDelayMs > 0) {
    console.warn("[genesys] rate limit backoff", {
      delayMs: safeDelayMs,
      resumeAt: new Date(resumeAt).toISOString(),
      ...context,
    });
    await wait(safeDelayMs);
  }
};

const parseRetryAfterMs = (response) => {
  const header = response?.headers?.get?.("retry-after");
  if (!header) {
    return null;
  }

  const trimmed = String(header).trim();
  if (!trimmed) {
    return null;
  }

  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const asDate = Date.parse(trimmed);
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return null;
};

const resolveRateLimitDelayMs = (response, retryAttempt) => {
  const retryAfterMs = parseRetryAfterMs(response);
  if (retryAfterMs != null && retryAfterMs > 0) {
    return retryAfterMs;
  }

  return Math.min(getRetryBaseDelayMs() * 2 ** retryAttempt, GENESYS_RATE_LIMIT_FALLBACK_MAX_DELAY_MS);
};

const resolveTransientDelayMs = (retryAttempt) =>
  Math.min(getRetryBaseDelayMs() * 2 ** retryAttempt, GENESYS_RATE_LIMIT_FALLBACK_MAX_DELAY_MS);

const acquireSlot = () =>
  new Promise((resolve) => {
    const tryAcquire = () => {
      if (activeSlots < getGenesysApiConcurrency()) {
        activeSlots += 1;
        resolve(releaseSlot);
        return;
      }

      waitQueue.push(tryAcquire);
    };

    tryAcquire();
  });

const releaseSlot = () => {
  activeSlots = Math.max(0, activeSlots - 1);
  const next = waitQueue.shift();
  if (next) {
    next();
  }
};

const scheduleGenesysRequest = async (run) => {
  const release = await acquireSlot();

  try {
    return await run();
  } finally {
    release();
  }
};

const runGenesysHttp = async (runFetch, context = {}) => {
  return scheduleGenesysRequest(async () => {
    let attempt = 0;
    let authRetried = false;

    while (true) {
      await waitUntilAllowed();

      const startedAt = Date.now();
      const response = await runFetch();
      const durationMs = Date.now() - startedAt;

      httpMetrics.requestCount += 1;
      httpMetrics.totalRequestDurationMs += durationMs;

      if (response.status === 429) {
        httpMetrics.rateLimit429Count += 1;
        httpMetrics.retryCount += 1;
        const delayMs = resolveRateLimitDelayMs(response, attempt);
        await applyRateLimitBackoff(delayMs, {
          attempt,
          retryAfter: response.headers?.get?.("retry-after") || null,
          event: "429_received",
          ...context,
        });
        attempt += 1;
        continue;
      }

      if (response.status === 401 && context.tokenManager && !authRetried) {
        authRetried = true;
        httpMetrics.retryCount += 1;
        await context.tokenManager.invalidate();
        try {
          await context.tokenManager.refresh();
        } catch {
          return response;
        }
        attempt += 1;
        continue;
      }

      if (TRANSIENT_STATUS_CODES.has(response.status) && attempt < getMaxHttpRetries()) {
        httpMetrics.retryCount += 1;
        const delayMs = resolveTransientDelayMs(attempt);
        await applyRateLimitBackoff(delayMs, {
          attempt,
          status: response.status,
          event: "api_retry",
          ...context,
        });
        attempt += 1;
        continue;
      }

      nextRequestAt = Math.max(nextRequestAt, Date.now() + GENESYS_MIN_REQUEST_INTERVAL_MS);
      return response;
    }
  });
};

export {
  GENESYS_MIN_REQUEST_INTERVAL_MS,
  GENESYS_RATE_LIMIT_FALLBACK_MAX_DELAY_MS,
  applyRateLimitBackoff,
  getGenesysHttpMetrics,
  parseRetryAfterMs,
  resetGenesysRequestScheduler,
  resolveRateLimitDelayMs,
  runGenesysHttp,
  scheduleGenesysRequest,
  waitUntilAllowed,
};
