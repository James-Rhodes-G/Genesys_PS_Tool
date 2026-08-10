import { Router } from "express";
import express from "express";
import { getCurrentUser } from "../lib/genesys.js";
import { getSessionConnection } from "../data/session-db.js";
import { MOCK_API_CONFIG } from "../lib/mock-api-config.js";
import { HTTP_STATUS_PRESETS } from "../lib/mock-api.js";

const sendError = (res, error, fallbackStatus = 400) => {
  const status = error?.statusCode || fallbackStatus;
  res.status(status).json({ error: error?.message || "Request failed." });
};

const createMockApiPublicRouter = ({ mockApiService, requestBodyLimit }) => {
  const router = Router();

  router.all(
    "/mockAPI/:userpart/:endpointSlug",
    express.raw({ type: "*/*", limit: requestBodyLimit }),
    async (req, res) => {
      try {
        await mockApiService.invokeEndpoint({
          req,
          res,
          userpart: req.params.userpart,
          endpointSlug: req.params.endpointSlug,
        });
      } catch (error) {
        if (!res.headersSent) {
          sendError(res, error, 500);
        }
      }
    }
  );

  return router;
};

const createMockApiManagementRouter = ({ mockApiService, sessionDb }) => {
  const router = Router();

  const getCredentials = (req) => ({
    region: req.body?.region || req.query?.region || req.get("x-genesys-region"),
    token: req.body?.token || req.query?.token || req.get("x-genesys-token"),
  });

  const resolveOwner = async (req, res) => {
    const { region, token } = getCredentials(req);
    if (!region || !token) {
      res.status(400).json({ error: "Genesys credentials are required." });
      return null;
    }

    const sessionId = req.sessionId;
    if (!sessionId) {
      res.status(400).json({ error: "Session is required." });
      return null;
    }

    const connection = await getSessionConnection(sessionDb, sessionId);
    if (!connection?.orgId) {
      res.status(409).json({ error: "Connect to an organization before managing mock endpoints." });
      return null;
    }

    try {
      const user = await getCurrentUser({ region, token });
      return mockApiService.buildOwnerContext({
        user,
        sessionId,
        orgId: connection.orgId,
        orgName: connection.orgName,
      });
    } catch (error) {
      res.status(502).json({ error: error.message || "Failed to resolve the current user." });
      return null;
    }
  };

  router.get("/api/mock-api/config", (_req, res) => {
    res.json({
      httpStatusPresets: HTTP_STATUS_PRESETS,
      allowedMethods: [...MOCK_API_CONFIG.allowedMethods],
      allowedContentTypes: [...MOCK_API_CONFIG.allowedContentTypes],
      allowedDelaysMs: MOCK_API_CONFIG.allowedDelaysMs,
      limits: {
        maxResponseBodyBytes: MOCK_API_CONFIG.maxResponseBodyBytes,
        maxRequestBodyBytes: MOCK_API_CONFIG.maxRequestBodyBytes,
        maxHeaders: MOCK_API_CONFIG.maxHeaders,
        maxHeaderValueBytes: MOCK_API_CONFIG.maxHeaderValueBytes,
        maxEndpointsPerUser: MOCK_API_CONFIG.maxEndpointsPerUser,
        maxRequestLogsPerEndpoint: MOCK_API_CONFIG.maxRequestLogsPerEndpoint,
        maxDelayMs: MOCK_API_CONFIG.maxDelayMs,
      },
      lifecycle: {
        inactivityMs: MOCK_API_CONFIG.inactivityMs,
        maxLifetimeMs: MOCK_API_CONFIG.maxLifetimeMs,
        retentionExpiredMs: MOCK_API_CONFIG.retentionExpiredMs,
      },
    });
  });

  router.get("/api/mock-api/context", async (req, res) => {
    const owner = await resolveOwner(req, res);
    if (!owner) {
      return;
    }

    res.json({
      ownerUserpart: owner.ownerUserpart,
      ownerEmail: owner.ownerEmail,
      publicUrlPrefix: `/mockAPI/${owner.ownerUserpart}/`,
    });
  });

  router.get("/api/mock-api/endpoints", async (req, res) => {
    const owner = await resolveOwner(req, res);
    if (!owner) {
      return;
    }

    try {
      const group = String(req.query.group || "active");
      const endpoints = await mockApiService.listOwnedEndpoints({ owner, group });
      res.json({ endpoints });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/api/mock-api/endpoints/:id", async (req, res) => {
    const owner = await resolveOwner(req, res);
    if (!owner) {
      return;
    }

    try {
      const endpoint = await mockApiService.getOwnedEndpoint({ owner, id: req.params.id });
      res.json({ endpoint });
    } catch (error) {
      sendError(res, error, 404);
    }
  });

  router.post("/api/mock-api/endpoints", async (req, res) => {
    const owner = await resolveOwner(req, res);
    if (!owner) {
      return;
    }

    try {
      const endpoint = await mockApiService.createEndpoint({
        owner,
        input: req.body || {},
        activate: Boolean(req.body?.activate),
      });
      res.status(201).json({ endpoint });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.put("/api/mock-api/endpoints/:id", async (req, res) => {
    const owner = await resolveOwner(req, res);
    if (!owner) {
      return;
    }

    try {
      const endpoint = await mockApiService.updateEndpointForOwner({
        owner,
        id: req.params.id,
        input: req.body || {},
      });
      res.json({ endpoint });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/api/mock-api/endpoints/:id/activate", async (req, res) => {
    const owner = await resolveOwner(req, res);
    if (!owner) {
      return;
    }

    try {
      const endpoint = await mockApiService.activateEndpoint({ owner, id: req.params.id });
      res.json({ endpoint });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/api/mock-api/endpoints/:id/archive", async (req, res) => {
    const owner = await resolveOwner(req, res);
    if (!owner) {
      return;
    }

    try {
      await mockApiService.archiveEndpoint({ owner, id: req.params.id });
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/api/mock-api/endpoints/:id/restore", async (req, res) => {
    const owner = await resolveOwner(req, res);
    if (!owner) {
      return;
    }

    try {
      const endpoint = await mockApiService.restoreEndpoint({ owner, id: req.params.id });
      res.json({ endpoint });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/api/mock-api/endpoints/:id/clone", async (req, res) => {
    const owner = await resolveOwner(req, res);
    if (!owner) {
      return;
    }

    try {
      const endpoint = await mockApiService.cloneEndpoint({ owner, id: req.params.id });
      res.status(201).json({ endpoint });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.delete("/api/mock-api/endpoints/:id", async (req, res) => {
    const owner = await resolveOwner(req, res);
    if (!owner) {
      return;
    }

    try {
      await mockApiService.deleteEndpoint({ owner, id: req.params.id });
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/api/mock-api/endpoints/:id/logs", async (req, res) => {
    const owner = await resolveOwner(req, res);
    if (!owner) {
      return;
    }

    try {
      const limit = Number(req.query.limit) || 100;
      const offset = Number(req.query.offset) || 0;
      const logs = await mockApiService.listEndpointLogs({
        owner,
        endpointId: req.params.id,
        limit,
        offset,
      });
      res.json({ logs });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/api/mock-api/logs/:logId", async (req, res) => {
    const owner = await resolveOwner(req, res);
    if (!owner) {
      return;
    }

    try {
      const log = await mockApiService.getEndpointLog({ owner, logId: req.params.logId });
      res.json({ log });
    } catch (error) {
      sendError(res, error, 404);
    }
  });

  return router;
};

export { createMockApiManagementRouter, createMockApiPublicRouter };
