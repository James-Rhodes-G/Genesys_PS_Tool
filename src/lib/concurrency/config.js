const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const parseNonNegativeInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
};

const WORKER_COUNT = parsePositiveInt(process.env.WORKER_COUNT, 4);
const GENESYS_API_CONCURRENCY = parsePositiveInt(process.env.GENESYS_API_CONCURRENCY, 4);
const MAX_RETRIES = parseNonNegativeInt(process.env.MAX_RETRIES, 5);
const RETRY_BASE_DELAY_MS = parsePositiveInt(process.env.RETRY_BASE_DELAY_MS, 1000);
const JOB_TTL_MS = parsePositiveInt(process.env.JOB_TTL_MS, 86400000);
const JOB_MAX_ITEMS = parsePositiveInt(process.env.JOB_MAX_ITEMS, 50000);
const MAX_HTTP_RETRIES = parseNonNegativeInt(process.env.MAX_HTTP_RETRIES, 5);

export {
  GENESYS_API_CONCURRENCY,
  JOB_MAX_ITEMS,
  JOB_TTL_MS,
  MAX_HTTP_RETRIES,
  MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
  WORKER_COUNT,
};
