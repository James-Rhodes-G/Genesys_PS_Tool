import { Router } from "express";
import { getJobManager } from "../lib/jobs/job-manager.js";
import { listJobTypes } from "../lib/jobs/handlers/index.js";
import { JOB_STATUS } from "../lib/jobs/types.js";

const TERMINAL_STATUSES = new Set([
  JOB_STATUS.COMPLETED,
  JOB_STATUS.COMPLETED_WITH_ERRORS,
  JOB_STATUS.FAILED,
  JOB_STATUS.CANCELLED,
]);

const createJobsRouter = ({ sessionDb } = {}) => {
  const router = Router();
  const jobManager = getJobManager({ sessionDb });

  const getCredentials = (req) => {
    if (req.genesysCredentials?.region && req.genesysCredentials?.token) {
      return req.genesysCredentials;
    }

    const region = req.body?.region || req.query?.region || req.get("x-genesys-region");
    const token = req.body?.token || req.query?.token || req.get("x-genesys-token");

    return { region, token };
  };

  const requireCredentials = (req, res) => {
    const { region, token } = getCredentials(req);

    if (!region || !token) {
      res.status(400).json({ error: "Both region and token are required." });
      return null;
    }

    return { region, token };
  };

  router.post("/api/jobs", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const type = String(req.body?.type || "").trim();
    const payload = req.body?.payload;

    if (!type) {
      res.status(400).json({ error: "type is required." });
      return;
    }

    if (!listJobTypes().includes(type)) {
      res.status(400).json({ error: `Unsupported job type: ${type}` });
      return;
    }

    if (!payload || typeof payload !== "object") {
      res.status(400).json({ error: "payload is required." });
      return;
    }

    try {
      const result = await jobManager.submitJob({
        type,
        payload,
        credentials,
        sessionId: req.sessionId || null,
      });
      res.status(202).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get("/api/jobs/:jobId", (req, res) => {
    const job = jobManager.getJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }

    res.status(200).json(job);
  });

  router.post("/api/jobs/:jobId/cancel", (req, res) => {
    const job = jobManager.cancelJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }

    res.status(200).json({
      jobId: job.id,
      status: job.status,
    });
  });

  router.get("/api/jobs/:jobId/results", (req, res) => {
    const job = jobManager.getJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }

    const offset = Number(req.query?.offset) || 0;
    const limit = Number(req.query?.limit) || 100;
    const userId = String(req.query?.userId || req.query?.itemId || "").trim();
    const results = jobManager.getJobResults(req.params.jobId, { offset, limit, userId: userId || null });

    res.status(200).json(results);
  });

  return router;
};

export { createJobsRouter };
