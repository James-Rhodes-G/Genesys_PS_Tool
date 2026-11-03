import { Router } from "express";
import { getSecurityPolicy } from "../lib/security-policy.js";
import { getUpdateStatus } from "../lib/github-update-check.js";

const createAppConfigRouter = () => {
  const router = Router();

  router.get("/api/app/security-policy", (_req, res) => {
    res.json(getSecurityPolicy());
  });

  router.get("/api/app/update", async (req, res) => {
    const extensionVersion = String(req.query.extensionVersion || "").trim();
    try {
      const status = await getUpdateStatus({
        extensionVersion: extensionVersion || undefined,
      });
      res.json(status);
    } catch (error) {
      res.status(503).json({ updateAvailable: false, error: error.message });
    }
  });

  return router;
};

export { createAppConfigRouter };
