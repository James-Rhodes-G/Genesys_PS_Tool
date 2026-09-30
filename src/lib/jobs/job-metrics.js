import { getGenesysHttpMetrics } from "../genesys-rate-limit.js";

const createJobMetricsCollector = () => {
  let startedAt = null;
  let retryCount = 0;

  const start = () => {
    startedAt = Date.now();
    retryCount = 0;
  };

  const recordRetry = (count = 1) => {
    retryCount += count;
  };

  const finalize = ({ total = 0, completed = 0, failed = 0 } = {}) => {
    const durationMs = startedAt ? Date.now() - startedAt : 0;
    const httpMetrics = getGenesysHttpMetrics();
    const itemsProcessed = completed + failed;
    const avgRequestDurationMs =
      httpMetrics.requestCount > 0 ? httpMetrics.totalRequestDurationMs / httpMetrics.requestCount : 0;
    const itemsPerSecond = durationMs > 0 ? itemsProcessed / (durationMs / 1000) : 0;

    return {
      durationMs,
      itemsProcessed,
      successfulItems: completed,
      failedItems: failed,
      retryCount: retryCount + httpMetrics.retryCount,
      rateLimit429Count: httpMetrics.rateLimit429Count,
      avgRequestDurationMs,
      itemsPerSecond,
    };
  };

  return { start, recordRetry, finalize };
};

export { createJobMetricsCollector };
