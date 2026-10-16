import { Router } from "express";
import { getSecurityPolicy } from "../lib/security-policy.js";

const createAppConfigRouter = () => {
  const router = Router();

  router.get("/api/app/security-policy", (_req, res) => {
    res.json(getSecurityPolicy());
  });

  return router;
};

export { createAppConfigRouter };
