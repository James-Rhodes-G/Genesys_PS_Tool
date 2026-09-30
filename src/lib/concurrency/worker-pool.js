const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const defaultIsRetryable = (error) => {
  const status = Number(error?.status);
  if (!Number.isFinite(status)) {
    return Boolean(error?.retryable);
  }
  return status === 401 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
};

const resolveBackoffMs = (attempt, baseDelayMs, error) => {
  const retryAfterMs = Number(error?.retryAfterMs);
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return retryAfterMs;
  }
  return Math.min(baseDelayMs * 2 ** Math.max(0, attempt - 1), 30000);
};

const createWorkerPool = ({ defaultConcurrency = 4, defaultMaxRetries = 5, defaultRetryBaseDelayMs = 1000 } = {}) => {
  const process = async (items, handler, options = {}) => {
    const concurrency = Math.max(1, Number(options.concurrency) || defaultConcurrency);
    const maxRetries = Number.isFinite(options.maxRetries) ? options.maxRetries : defaultMaxRetries;
    const retryBaseDelayMs = Number(options.retryBaseDelayMs) || defaultRetryBaseDelayMs;
    const isRetryable = options.isRetryable || defaultIsRetryable;
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    const onItemComplete = typeof options.onItemComplete === "function" ? options.onItemComplete : null;
    const signal = options.signal || null;
    const jobId = options.jobId || null;

    const normalizedItems = Array.isArray(items) ? items : [];
    const total = normalizedItems.length;
    const results = new Array(total);
    const pendingQueue = normalizedItems.map((item, index) => ({
      index,
      item,
      attempts: 0,
    }));

    let completed = 0;
    let failed = 0;
    let activeCount = 0;
    let maxActiveObserved = 0;
    let workerCounter = 0;

    const emitProgress = () => {
      if (!onProgress) {
        return;
      }

      onProgress({
        total,
        completed,
        failed,
        processing: activeCount,
        pending: pendingQueue.length,
      });
    };

    const runWorker = async () => {
      const workerId = `w${++workerCounter}`;

      while (pendingQueue.length > 0) {
        if (signal?.aborted) {
          break;
        }

        const entry = pendingQueue.shift();
        if (!entry) {
          break;
        }

        activeCount += 1;
        maxActiveObserved = Math.max(maxActiveObserved, activeCount);
        emitProgress();

        const itemId = entry.item?.itemId ?? entry.item?.id ?? String(entry.index);
        const ctx = {
          workerId,
          attempt: entry.attempts + 1,
          jobId,
          itemId,
          signal,
        };

        try {
          const result = await handler(entry.item, ctx);
          results[entry.index] = {
            itemId,
            status: "success",
            result,
            attempts: entry.attempts + 1,
          };
          completed += 1;
          onItemComplete?.(results[entry.index]);
        } catch (error) {
          entry.attempts += 1;

          if (entry.attempts <= maxRetries && isRetryable(error) && !signal?.aborted) {
            const delayMs = resolveBackoffMs(entry.attempts, retryBaseDelayMs, error);
            await wait(delayMs);
            pendingQueue.push(entry);
          } else {
            results[entry.index] = {
              itemId,
              status: "failed",
              error: error?.message || String(error),
              details: error?.details || null,
              statusCode: error?.status || null,
              attempts: entry.attempts,
            };
            failed += 1;
            onItemComplete?.(results[entry.index]);
          }
        } finally {
          activeCount -= 1;
          emitProgress();
        }
      }
    };

    const workerCount = Math.min(concurrency, Math.max(total, 1));
    const workers = Array.from({ length: workerCount }, () => runWorker());
    await Promise.all(workers);

    emitProgress();

    return {
      results: results.filter(Boolean),
      summary: {
        total,
        completed,
        failed,
        maxActiveObserved,
      },
    };
  };

  return { process };
};

export { createWorkerPool, defaultIsRetryable, resolveBackoffMs };
