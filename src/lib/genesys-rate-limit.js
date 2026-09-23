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

let queue = Promise.resolve();
let nextRequestAt = 0;

const resetGenesysRequestScheduler = () => {
  queue = Promise.resolve();
  nextRequestAt = 0;
};

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

  return Math.min(1000 * 2 ** retryAttempt, GENESYS_RATE_LIMIT_FALLBACK_MAX_DELAY_MS);
};

const scheduleGenesysRequest = async (run) => {
  const previous = queue;
  let release;

  queue = new Promise((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await run();
  } finally {
    release();
  }
};

const runGenesysHttp = async (runFetch, context = {}) => {
  return scheduleGenesysRequest(async () => {
    let attempt = 0;

    while (true) {
      await waitUntilAllowed();

      const response = await runFetch();

      if (response.status === 429) {
        const delayMs = resolveRateLimitDelayMs(response, attempt);
        await applyRateLimitBackoff(delayMs, {
          attempt,
          retryAfter: response.headers?.get?.("retry-after") || null,
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
  parseRetryAfterMs,
  resetGenesysRequestScheduler,
  resolveRateLimitDelayMs,
  runGenesysHttp,
  scheduleGenesysRequest,
  waitUntilAllowed,
};
