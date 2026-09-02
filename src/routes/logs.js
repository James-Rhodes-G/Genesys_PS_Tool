import { Router } from "express";
import { renderAppPage, renderLogDetail, renderLogList } from "../views/render.js";

const createLogsRouter = ({ getLogs, getLogById }) => {
  const router = Router();

  router.get("/", async (req, res) => {
    res.status(200).send(
      renderAppPage({
        vaultLaunch: Boolean(req.genesysCredentials?.vaultMode),
      })
    );
  });

  router.get("/api/logs", async (_req, res) => {
    const logs = await getLogs();
    res.status(200).json({ logs });
  });

  router.get("/api/logs/:id", async (req, res) => {
    const log = await getLogById(req.params.id);
    if (!log) {
      res.status(404).json({ error: "Log not found" });
      return;
    }
    res.status(200).json({ log });
  });

  router.get("/logs/:id", async (req, res) => {
    const log = await getLogById(req.params.id);

    if (!log) {
      res.status(404).send(renderLogList({ logs: [] }));
      return;
    }

    res.status(200).send(renderLogDetail({ log }));
  });

  return router;
};

export { createLogsRouter };
