import { Router } from "express";
import {
  bindSessionConnection,
  clearSessionData,
  getAllExportRows,
  getExportRows,
  getSessionConnection,
  getUserSyncState,
  saveExportResult,
} from "../data/session-db.js";
import { readCachedSessionUsers, syncSessionUsers, USERS_CACHE_EXPAND } from "../lib/user-cache.js";

const createSessionRouter = ({ sessionDb }) => {
  const router = Router();

  const requireSession = (req, res) => {
    if (!req.sessionId) {
      res.status(400).json({ error: "Session is required." });
      return null;
    }

    return req.sessionId;
  };

  const requireBoundSession = async (req, res) => {
    const sessionId = requireSession(req, res);
    if (!sessionId) {
      return null;
    }

    const connection = await getSessionConnection(sessionDb, sessionId);
    if (!connection?.orgId) {
      res.status(409).json({ error: "No active organization connection for this session." });
      return null;
    }

    return { sessionId, ...connection };
  };

  router.post("/api/session/bind", async (req, res) => {
    const sessionId = requireSession(req, res);
    if (!sessionId) {
      return;
    }

    const orgId = String(req.body?.orgId || "").trim();
    const orgName = String(req.body?.orgName || "").trim();
    const region = String(req.body?.region || "").trim();

    if (!orgId) {
      res.status(400).json({ error: "orgId is required." });
      return;
    }

    try {
      const connection = await bindSessionConnection(sessionDb, {
        sessionId,
        orgId,
        orgName,
        region,
      });
      res.status(200).json({ connection });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to bind session." });
    }
  });

  router.post("/api/session/clear", async (req, res) => {
    const sessionId = requireSession(req, res);
    if (!sessionId) {
      return;
    }

    try {
      await clearSessionData(sessionDb, sessionId);
      res.status(200).json({ cleared: true });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to clear session." });
    }
  });

  router.get("/api/session/status", async (req, res) => {
    const sessionId = requireSession(req, res);
    if (!sessionId) {
      return;
    }

    try {
      const connection = await getSessionConnection(sessionDb, sessionId);
      res.status(200).json({ connection: connection || null });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to read session status." });
    }
  });

  router.get("/api/session/users/status", async (req, res) => {
    const bound = await requireBoundSession(req, res);
    if (!bound) {
      return;
    }

    try {
      const sync = await getUserSyncState(sessionDb, {
        sessionId: bound.sessionId,
        orgId: bound.orgId,
      });
      res.status(200).json({
        sync: sync || { status: "idle", userCount: 0, syncedCount: 0 },
        expandProfile: USERS_CACHE_EXPAND,
      });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to read user sync status." });
    }
  });

  router.post("/api/session/users/sync", async (req, res) => {
    const bound = await requireBoundSession(req, res);
    if (!bound) {
      return;
    }

    const region = String(req.body?.region || "").trim();
    const token = String(req.body?.token || "").trim();
    const force = Boolean(req.body?.force);

    if (!region || !token) {
      res.status(400).json({ error: "Both region and token are required." });
      return;
    }

    try {
      const sync = await syncSessionUsers({
        db: sessionDb,
        sessionId: bound.sessionId,
        orgId: bound.orgId,
        region,
        token,
        force,
      });
      res.status(200).json({ sync });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message || "Failed to sync users.",
        details: error.details || null,
      });
    }
  });

  router.get("/api/session/users", async (req, res) => {
    const bound = await requireBoundSession(req, res);
    if (!bound) {
      return;
    }

    try {
      const { sync, users } = await readCachedSessionUsers(sessionDb, {
        sessionId: bound.sessionId,
        orgId: bound.orgId,
      });

      if (!users) {
        res.status(409).json({
          error: "Users are not synced for this session.",
          sync: sync || { status: "idle" },
        });
        return;
      }

      res.status(200).json({ users, sync });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to load cached users." });
    }
  });

  router.post("/api/session/exports", async (req, res) => {
    const bound = await requireBoundSession(req, res);
    if (!bound) {
      return;
    }

    const exportId = String(req.body?.exportId || req.body?.resultId || "").trim();
    if (!exportId) {
      res.status(400).json({ error: "exportId is required." });
      return;
    }

    try {
      const payload = await saveExportResult(sessionDb, {
        sessionId: bound.sessionId,
        orgId: bound.orgId,
        exportId,
        exportType: req.body?.exportType || "",
        title: req.body?.title || "",
        status: req.body?.status || "",
        meta: req.body?.meta || {},
        rows: req.body?.rows || [],
      });
      res.status(200).json(payload);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to save export." });
    }
  });

  router.get("/api/session/exports/:exportId/rows", async (req, res) => {
    const bound = await requireBoundSession(req, res);
    if (!bound) {
      return;
    }

    try {
      const payload = await getExportRows(sessionDb, {
        exportId: req.params.exportId,
        sessionId: bound.sessionId,
        orgId: bound.orgId,
        offset: req.query.offset,
        limit: req.query.limit,
      });

      if (!payload) {
        res.status(404).json({ error: "Export not found for this session and organization." });
        return;
      }

      res.status(200).json(payload);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to load export rows." });
    }
  });

  router.get("/api/session/exports/:exportId/rows/all", async (req, res) => {
    const bound = await requireBoundSession(req, res);
    if (!bound) {
      return;
    }

    try {
      const payload = await getAllExportRows(sessionDb, {
        exportId: req.params.exportId,
        sessionId: bound.sessionId,
        orgId: bound.orgId,
      });

      if (!payload) {
        res.status(404).json({ error: "Export not found for this session and organization." });
        return;
      }

      res.status(200).json(payload);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to load export rows." });
    }
  });

  return router;
};

export { createSessionRouter };
