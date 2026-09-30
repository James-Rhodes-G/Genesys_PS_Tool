import { JOB_TTL_MS } from "../concurrency/config.js";

const createInMemoryJobStore = ({ ttlMs = JOB_TTL_MS } = {}) => {
  const jobs = new Map();
  let sweepTimer = null;

  const sweep = () => {
    const cutoff = Date.now() - ttlMs;
    for (const [jobId, job] of jobs.entries()) {
      if (job.completedAt && job.completedAt < cutoff) {
        jobs.delete(jobId);
      }
    }
  };

  const startSweep = () => {
    if (sweepTimer) {
      return;
    }
    sweepTimer = setInterval(sweep, Math.min(ttlMs, 3600000));
    if (typeof sweepTimer.unref === "function") {
      sweepTimer.unref();
    }
  };

  const create = (job) => {
    jobs.set(job.id, job);
    return job;
  };

  const get = (jobId) => jobs.get(jobId) || null;

  const update = (jobId, patch) => {
    const existing = jobs.get(jobId);
    if (!existing) {
      return null;
    }

    const next = { ...existing, ...patch };
    jobs.set(jobId, next);
    return next;
  };

  const remove = (jobId) => jobs.delete(jobId);

  startSweep();

  return { create, get, update, delete: remove, sweep };
};

export { createInMemoryJobStore };
