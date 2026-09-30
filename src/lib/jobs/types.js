const JOB_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  COMPLETED_WITH_ERRORS: "completed_with_errors",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

const WORK_ITEM_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
};

const createEmptyJobMetrics = () => ({
  durationMs: 0,
  itemsProcessed: 0,
  successfulItems: 0,
  failedItems: 0,
  retryCount: 0,
  rateLimit429Count: 0,
  avgRequestDurationMs: 0,
  itemsPerSecond: 0,
});

const createJobSnapshot = (job) => ({
  jobId: job.id,
  type: job.type,
  status: job.status,
  createdAt: job.createdAt,
  startedAt: job.startedAt,
  completedAt: job.completedAt,
  total: job.total,
  pending: job.pending,
  processing: job.processing,
  completed: job.completed,
  failed: job.failed,
  resultsCount: Number(job.resultsCount) || (Array.isArray(job.results) ? job.results.length : 0),
  metrics: job.metrics ? { ...job.metrics } : null,
});

export { JOB_STATUS, WORK_ITEM_STATUS, createEmptyJobMetrics, createJobSnapshot };
