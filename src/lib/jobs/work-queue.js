import { WORK_ITEM_STATUS } from "./types.js";

const createInMemoryWorkQueue = () => {
  const queues = new Map();

  const getQueue = (jobId) => {
    if (!queues.has(jobId)) {
      queues.set(jobId, []);
    }
    return queues.get(jobId);
  };

  const enqueue = (jobId, items) => {
    const queue = getQueue(jobId);
    const normalized = items.map((item) => ({
      jobId,
      itemId: item.itemId,
      payload: item.payload ?? item,
      status: WORK_ITEM_STATUS.PENDING,
      attempts: 0,
      error: null,
      result: null,
      startedAt: null,
      completedAt: null,
    }));
    queue.push(...normalized);
    return normalized.length;
  };

  const list = (jobId) => getQueue(jobId).slice();

  const pendingCount = (jobId) =>
    getQueue(jobId).filter((item) => item.status === WORK_ITEM_STATUS.PENDING).length;

  const markProcessing = (jobId, itemId) => {
    const item = getQueue(jobId).find((entry) => entry.itemId === itemId);
    if (!item) {
      return null;
    }
    item.status = WORK_ITEM_STATUS.PROCESSING;
    item.startedAt = Date.now();
    return item;
  };

  const markComplete = (jobId, itemId, result) => {
    const item = getQueue(jobId).find((entry) => entry.itemId === itemId);
    if (!item) {
      return null;
    }
    item.status = WORK_ITEM_STATUS.COMPLETED;
    item.result = result;
    item.completedAt = Date.now();
    return item;
  };

  const markFailed = (jobId, itemId, error) => {
    const item = getQueue(jobId).find((entry) => entry.itemId === itemId);
    if (!item) {
      return null;
    }
    item.status = WORK_ITEM_STATUS.FAILED;
    item.error = error;
    item.completedAt = Date.now();
    return item;
  };

  const clear = (jobId) => queues.delete(jobId);

  return {
    enqueue,
    list,
    pendingCount,
    markProcessing,
    markComplete,
    markFailed,
    clear,
  };
};

export { createInMemoryWorkQueue };
