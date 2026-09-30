import crypto from "crypto";
import { log } from "../structured-log.js";
import { createWorkerPool } from "../concurrency/worker-pool.js";
import { JOB_MAX_ITEMS, MAX_RETRIES, WORKER_COUNT } from "../concurrency/config.js";
import { resetGenesysRequestScheduler } from "../genesys-rate-limit.js";
import { createTokenManager } from "../genesys/token-manager.js";
import { createGenesysApiClient } from "../genesys/api-client.js";
import { createInMemoryJobStore } from "./job-store.js";
import { createInMemoryWorkQueue } from "./work-queue.js";
import { createJobMetricsCollector } from "./job-metrics.js";
import { JOB_STATUS, createEmptyJobMetrics, createJobSnapshot } from "./types.js";
import { getJobHandler } from "./handlers/index.js";

const createJobManager = ({
  jobStore = createInMemoryJobStore(),
  workQueue = createInMemoryWorkQueue(),
  workerPool = createWorkerPool({ defaultConcurrency: WORKER_COUNT, defaultMaxRetries: MAX_RETRIES }),
  sessionDb = null,
} = {}) => {
  const abortControllers = new Map();

  const submitJob = async ({ type, payload, credentials, sessionId = null }) => {
    const handler = getJobHandler(type);
    if (!handler) {
      throw new Error(`Unsupported job type: ${type}`);
    }

    if (!credentials?.region || !credentials?.token) {
      throw new Error("Both region and token are required.");
    }

    const items = handler.buildItems(payload);
    if (items.length > JOB_MAX_ITEMS) {
      throw new Error(`Job exceeds maximum item count of ${JOB_MAX_ITEMS}.`);
    }

    const jobId = crypto.randomUUID();
    const now = Date.now();

    const job = {
      id: jobId,
      type,
      status: JOB_STATUS.QUEUED,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      total: items.length,
      pending: items.length,
      processing: 0,
      completed: 0,
      failed: 0,
      errors: [],
      metrics: createEmptyJobMetrics(),
      credentials: {
        region: credentials.region,
        token: credentials.token,
        sessionId: sessionId || null,
      },
      payload,
      results: [],
      resultsCount: 0,
    };

    jobStore.create(job);
    workQueue.enqueue(jobId, items);

    log("info", "job_created", { jobId, type, total: items.length });

    setImmediate(() => {
      runJob(jobId).catch((error) => {
        log("error", "job_failed", { jobId, type, error: error.message });
        jobStore.update(jobId, {
          status: JOB_STATUS.FAILED,
          completedAt: Date.now(),
          errors: [{ itemId: null, message: error.message, status: JOB_STATUS.FAILED, attempts: 0 }],
        });
      });
    });

    return { jobId, status: JOB_STATUS.QUEUED };
  };

  const runJob = async (jobId) => {
    const job = jobStore.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const handler = getJobHandler(job.type);
    if (!handler) {
      throw new Error(`Unsupported job type: ${job.type}`);
    }

    const abortController = new AbortController();
    abortControllers.set(jobId, abortController);

    resetGenesysRequestScheduler();

    const tokenManager = createTokenManager({
      region: job.credentials.region,
      token: job.credentials.token,
      sessionId: job.credentials.sessionId,
      sessionDb,
    });

    const apiClient = createGenesysApiClient({
      tokenManager,
      region: job.credentials.region,
      jobId,
    });

    const metricsCollector = createJobMetricsCollector();
    metricsCollector.start();

    jobStore.update(jobId, {
      status: JOB_STATUS.RUNNING,
      startedAt: Date.now(),
    });

    log("info", "job_started", { jobId, type: job.type, workerCount: WORKER_COUNT });

    const queueItems = workQueue.list(jobId);

    const appendJobResult = (poolRow) => {
      if (!poolRow) {
        return;
      }

      const builtRows = handler.buildResults ? handler.buildResults([poolRow]) : [poolRow];
      const builtRow = builtRows[0];
      if (!builtRow) {
        return;
      }

      const currentJob = jobStore.get(jobId);
      const nextResults = [...(currentJob?.results || []), builtRow];
      jobStore.update(jobId, {
        results: nextResults,
        resultsCount: nextResults.length,
      });
    };

    const { results, summary } = await workerPool.process(
      queueItems,
      async (item, ctx) => {
        workQueue.markProcessing(jobId, item.itemId);
        log("debug", "worker_started_item", {
          jobId,
          itemId: item.itemId,
          workerId: ctx.workerId,
          attempt: ctx.attempt,
        });

        try {
          const result = await handler.processItem(item, {
            ...ctx,
            jobId,
            apiClient,
            tokenManager,
          });
          workQueue.markComplete(jobId, item.itemId, result);
          log("debug", "item_completed", { jobId, itemId: item.itemId, workerId: ctx.workerId });
          return result;
        } catch (error) {
          workQueue.markFailed(jobId, item.itemId, {
            message: error.message,
            status: error.status || null,
            details: error.details || null,
          });
          throw error;
        }
      },
      {
        concurrency: WORKER_COUNT,
        maxRetries: MAX_RETRIES,
        jobId,
        signal: abortController.signal,
        onProgress: (progress) => {
          jobStore.update(jobId, {
            total: progress.total,
            pending: progress.pending,
            processing: progress.processing,
            completed: progress.completed,
            failed: progress.failed,
          });
        },
        onItemComplete: appendJobResult,
      }
    );

    const builtResults = handler.buildResults ? handler.buildResults(results) : results;
    const errors = results
      .filter((row) => row.status === "failed")
      .map((row) => ({
        itemId: row.itemId,
        message: row.error,
        status: row.statusCode || null,
        attempts: row.attempts,
      }));

    let finalStatus = JOB_STATUS.COMPLETED;
    if (summary.failed > 0 && summary.completed > 0) {
      finalStatus = JOB_STATUS.COMPLETED_WITH_ERRORS;
    } else if (summary.failed > 0 && summary.completed === 0) {
      finalStatus = JOB_STATUS.FAILED;
    }

    if (abortController.signal.aborted) {
      finalStatus = JOB_STATUS.CANCELLED;
    }

    const metrics = metricsCollector.finalize({
      total: summary.total,
      completed: summary.completed,
      failed: summary.failed,
    });

    jobStore.update(jobId, {
      status: finalStatus,
      completedAt: Date.now(),
      total: summary.total,
      pending: 0,
      processing: 0,
      completed: summary.completed,
      failed: summary.failed,
      results: builtResults,
      errors,
      metrics,
    });

    abortControllers.delete(jobId);
    workQueue.clear(jobId);

    if (typeof handler.cleanupJob === "function") {
      handler.cleanupJob(jobId);
    }

    log("info", "job_completed", { jobId, status: finalStatus, metrics });

    return jobStore.get(jobId);
  };

  const getJob = (jobId) => {
    const job = jobStore.get(jobId);
    return job ? createJobSnapshot(job) : null;
  };

  const getJobResults = (jobId, { offset = 0, limit = 100, userId = null } = {}) => {
    const job = jobStore.get(jobId);
    if (!job) {
      return null;
    }

    const safeOffset = Math.max(0, Number(offset) || 0);
    const safeLimit = Math.min(1000, Math.max(1, Number(limit) || 100));
    let rows = Array.isArray(job.results) ? job.results : [];

    if (userId) {
      rows = rows.filter(
        (row) =>
          String(row?.userId || row?.itemId || "") === String(userId) ||
          String(row?.phoneId || "") === String(userId) ||
          String(row?.conversationId || "") === String(userId)
      );
    }

    const isTerminal = [
      JOB_STATUS.COMPLETED,
      JOB_STATUS.COMPLETED_WITH_ERRORS,
      JOB_STATUS.FAILED,
      JOB_STATUS.CANCELLED,
    ].includes(job.status);

    return {
      jobId: job.id,
      status: job.status,
      total: rows.length,
      resultsCount: Number(job.resultsCount) || rows.length,
      partial: !isTerminal,
      offset: safeOffset,
      limit: safeLimit,
      results: rows.slice(safeOffset, safeOffset + safeLimit),
    };
  };

  const cancelJob = (jobId) => {
    const controller = abortControllers.get(jobId);
    if (controller) {
      controller.abort();
    }
    return jobStore.update(jobId, { status: JOB_STATUS.CANCELLED });
  };

  return {
    submitJob,
    runJob,
    getJob,
    getJobResults,
    cancelJob,
    jobStore,
    workQueue,
  };
};

let sharedJobManager = null;

const getJobManager = (options = {}) => {
  if (!sharedJobManager) {
    sharedJobManager = createJobManager(options);
  }
  return sharedJobManager;
};

export { createJobManager, getJobManager };
