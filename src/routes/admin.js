import { Router } from "express";
import { requireOperator } from "../lib/admin-auth.js";
import { getAppInfo, getDbSizes, getPlatformSnapshot } from "../lib/platform-metrics.js";
import { runBackup } from "../lib/admin-jobs.js";

const parseTimeRange = (req) => {
  const now = Date.now();
  const range = req.query.range || "24h";
  const ranges = { "1h": 3600000, "24h": 86400000, "7d": 604800000, "30d": 2592000000 };
  const from = req.query.from ? Number(req.query.from) : now - (ranges[range] || ranges["24h"]);
  const to = req.query.to ? Number(req.query.to) : now;
  return { from, to };
};

const parseOptionalTimeRange = (req) => {
  if (req.query.range || req.query.from || req.query.to) {
    return parseTimeRange(req);
  }
  return { from: undefined, to: undefined };
};

const createAdminRouter = ({
  adminDb,
  sessionDb,
  mockApiDb,
  auditService,
  insertAdminEvent,
  listAdminEvents,
  countAdminEvents,
  listAdminActivity,
  insertAdminActivity,
  listPresenceSnapshots,
  listStorageSnapshots,
  listPlatformSnapshots,
  listAggregatedRouteStats,
  countAggregatedRouteStats,
  listBackupRuns,
  insertBackupRun,
  listJobRuns,
  getLastJobRun,
  getMaintenanceMode,
  setMaintenanceMode,
  getConnectedUsers,
  listActiveSessionCredentials,
  listActiveCredentialVault,
  revokeSessionById,
  revokeCredentialVault,
  clearSessionCredentials,
  listAllEndpoints,
  getEndpointByIdAdmin,
  markEndpointStatusAdmin,
  getEndpointStats24h,
  getGlobalMockApiTraffic,
  listHourlyTraffic,
  listRequestLogsAdmin,
  mockApiService,
  takePresenceSnapshot,
  takeStorageSnapshot,
  takePlatformSnapshot,
}) => {
  const router = Router();
  const op = [requireOperator];

  router.get("/api/admin/events", ...op, async (req, res) => {
    const { from, to } = parseOptionalTimeRange(req);
    const limit = Math.min(Number(req.query.limit) || 25, 200);
    const offset = Number(req.query.offset) || 0;
    const filters = {
      orgId: req.query.orgId?.trim() || undefined,
      userName: req.query.userName?.trim() || undefined,
      action: req.query.action?.trim() || undefined,
      dangerousOnly: req.query.dangerous === "1",
      from,
      to,
      limit,
      offset,
    };
    const events = await listAdminEvents(adminDb, filters);
    const total = await countAdminEvents(adminDb, filters);
    res.json({ events, total, limit, offset });
  });

  router.get("/api/admin/activity", async (req, res) => {
    const activities = await listAdminActivity(adminDb, {
      sessionId: req.sessionId,
      orgId: req.query.orgId,
      limit: Math.min(Number(req.query.limit) || 50, 200),
    });
    res.json({ activities });
  });

  router.post("/api/admin/activity", async (req, res) => {
    if (!req.sessionId) {
      return res.status(401).json({ error: "Session required." });
    }
    const { action, affectedCount, successCount, failureCount } = req.body || {};
    if (!action) {
      return res.status(400).json({ error: "action is required." });
    }
    const id = await insertAdminActivity(adminDb, {
      sessionId: req.sessionId,
      orgId: req.genesysCredentials?.orgId || req.body?.orgId,
      userId: req.genesysCredentials?.userId,
      action,
      affectedCount: affectedCount ?? 0,
      successCount: successCount ?? 0,
      failureCount: failureCount ?? 0,
    });
    res.json({ id });
  });

  router.get("/api/admin/dangerous-actions", ...op, async (req, res) => {
    const from = Date.now() - 24 * 60 * 60 * 1000;
    const events = await listAdminEvents(adminDb, { dangerousOnly: true, from, limit: 100 });
    res.json({ events, count: events.length });
  });

  router.get("/api/admin/dashboard/summary", ...op, async (_req, res) => {
    const users = await getConnectedUsers(sessionDb);
    const uniqueUserIds = new Set(users.map((u) => u.userId).filter(Boolean));
    const uniqueOrgIds = new Set(users.map((u) => u.orgId).filter(Boolean));
    const mockTraffic = await getGlobalMockApiTraffic(mockApiDb);
    const sizes = getDbSizes();
    const maintenance = await getMaintenanceMode(adminDb);
    res.json({
      connected: {
        uniqueUsers: uniqueUserIds.size,
        activeSessions: users.length,
        connectedOrgs: uniqueOrgIds.size,
      },
      mockApi24h: mockTraffic,
      storage: sizes,
      maintenance: maintenance.mode,
      ...getAppInfo(),
    });
  });

  router.get("/api/admin/dashboard/presence", ...op, async (req, res) => {
    const { from, to } = parseTimeRange(req);
    const snapshots = await listPresenceSnapshots(adminDb, { from, to });
    res.json({ snapshots: snapshots.map((s) => ({
      snapshotAt: s.snapshot_at,
      connectedSessions: s.connected_sessions,
      uniqueUsers: s.unique_users,
      uniqueOrgs: s.unique_orgs,
    })) });
  });

  router.get("/api/admin/dashboard/mock-api-traffic", ...op, async (req, res) => {
    const { from, to } = parseTimeRange(req);
    const traffic = await listHourlyTraffic(mockApiDb, { from, to });
    const totals = await getGlobalMockApiTraffic(mockApiDb, { from, to });
    res.json({ traffic, totals });
  });

  router.get("/api/admin/dashboard/storage", ...op, async (req, res) => {
    const { from, to } = parseTimeRange(req);
    const snapshots = await listStorageSnapshots(adminDb, { from, to });
    res.json({
      current: getDbSizes(),
      snapshots: snapshots.map((s) => ({
        snapshotAt: s.snapshot_at,
        sessionDbBytes: s.session_db_bytes,
        mockApiDbBytes: s.mock_api_db_bytes,
        logsDbBytes: s.logs_db_bytes,
        adminDbBytes: s.admin_db_bytes,
      })),
    });
  });

  router.get("/api/admin/dashboard/platform", ...op, async (req, res) => {
    const { from, to } = parseTimeRange(req);
    const snapshots = await listPlatformSnapshots(adminDb, { from, to });
    res.json({
      current: { ...getPlatformSnapshot(), ...getAppInfo() },
      snapshots: snapshots.map((s) => ({
        snapshotAt: s.snapshot_at,
        cpuPercent: s.cpu_percent,
        memoryHeapBytes: s.memory_heap_bytes,
        memoryRssBytes: s.memory_rss_bytes,
        diskFreeBytes: s.disk_free_bytes,
      })),
    });
  });

  router.get("/api/admin/dashboard/core-api", ...op, async (req, res) => {
    const { from, to } = parseTimeRange(req);
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = Number(req.query.offset) || 0;
    const stats = await listAggregatedRouteStats(adminDb, { from, to, limit, offset });
    const total = await countAggregatedRouteStats(adminDb, { from, to });
    res.json({
      stats: stats.map((s) => ({
        routeFamily: s.route_family,
        callCount: s.call_count,
        errorCount: s.error_count,
        avgResponseTimeMs: s.call_count ? Math.round(s.total_response_time_ms / s.call_count) : 0,
        maxResponseTimeMs: s.max_response_time_ms,
      })),
      total,
      limit,
      offset,
    });
  });

  router.get("/api/admin/dashboard/connected-users", ...op, async (req, res) => {
    const users = await getConnectedUsers(sessionDb);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    res.json({ users: users.slice(offset, offset + limit), total: users.length });
  });

  router.get("/api/admin/launch-funnel", ...op, async (req, res) => {
    const { from, to } = parseTimeRange(req);
    const actions = ["launch_pair", "launch_handoff", "launch_consume", "launch_disconnect", "launch_unpair"];
    const events = await listAdminEvents(adminDb, { from, to, limit: 1000 });
    const funnel = {};
    for (const action of actions) {
      const matching = events.filter((e) => e.action === action);
      funnel[action] = {
        total: matching.length,
        success: matching.filter((e) => e.status === "success").length,
        failure: matching.filter((e) => e.status === "failure").length,
      };
    }
    const recentFailures = events.filter((e) => e.status === "failure" && e.feature === "launch").slice(0, 20);
    res.json({ funnel, recentFailures });
  });

  router.get("/api/admin/sessions", ...op, async (_req, res) => {
    const credentials = await listActiveSessionCredentials(sessionDb);
    const vault = await listActiveCredentialVault(sessionDb);
    res.json({ credentials, vault });
  });

  router.post("/api/admin/sessions/:sessionId/revoke", ...op, async (req, res) => {
    await revokeSessionById(sessionDb, req.params.sessionId);
    await auditService.recordEvent(req, {
      action: "admin_revoke_session",
      feature: "admin",
      status: "success",
      metaJson: { sessionId: req.params.sessionId },
    });
    res.json({ ok: true });
  });

  router.post("/api/admin/vault/:linkId/revoke", ...op, async (req, res) => {
    await revokeCredentialVault(sessionDb, req.params.linkId);
    await auditService.recordEvent(req, {
      action: "admin_revoke_vault",
      feature: "admin",
      status: "success",
      metaJson: { linkId: req.params.linkId },
    });
    res.json({ ok: true });
  });

  router.get("/api/admin/usage", ...op, async (req, res) => {
    const { from, to } = parseTimeRange(req);
    const events = await listAdminEvents(adminDb, { from, to, limit: 5000 });
    const byAction = {};
    const byOrg = {};
    const byFeature = {};
    for (const event of events) {
      byAction[event.action] = (byAction[event.action] || 0) + 1;
      if (event.orgId) byOrg[event.orgId] = (byOrg[event.orgId] || 0) + 1;
      if (event.feature) byFeature[event.feature] = (byFeature[event.feature] || 0) + 1;
    }
    res.json({ byAction, byOrg, byFeature, totalEvents: events.length, from, to });
  });

  router.get("/api/admin/compliance", ...op, async (_req, res) => {
    const checks = [
      { name: "VAULT_ENCRYPTION_KEY", ok: Boolean(process.env.VAULT_ENCRYPTION_KEY?.length >= 32) },
      { name: "LAUNCH_HMAC_SECRET", ok: Boolean(process.env.LAUNCH_HMAC_SECRET) || process.env.NODE_ENV !== "production" },
      { name: "LAUNCH_BASE_URL_HTTPS", ok: !process.env.LAUNCH_BASE_URL || process.env.LAUNCH_BASE_URL.startsWith("https://") },
      { name: "ADMIN_AUTH", ok: Boolean(process.env.PS_TOOL_ADMIN_KEY || process.env.PS_TOOL_ADMIN_EMAILS) },
    ];
    res.json({ checks, allOk: checks.every((c) => c.ok) });
  });

  router.get("/api/admin/mock-api/endpoints", ...op, async (req, res) => {
    const endpoints = await listAllEndpoints(mockApiDb, {
      limit: Math.min(Number(req.query.limit) || 200, 500),
      offset: Number(req.query.offset) || 0,
    });
    const enriched = await Promise.all(
      endpoints.map(async (ep) => ({
        ...ep,
        publicUrl: `/mockAPI/${ep.ownerUserpart}/${ep.endpointSlug}`,
        stats24h: await getEndpointStats24h(mockApiDb, ep.id),
      }))
    );
    res.json({ endpoints: enriched });
  });

  router.get("/api/admin/mock-api/endpoints/:id/metrics", ...op, async (req, res) => {
    const { from, to } = parseTimeRange(req);
    const stats = await listHourlyTraffic(mockApiDb, { from, to });
    const endpointStats = await getEndpointStats24h(mockApiDb, req.params.id);
    res.json({ stats, endpointStats });
  });

  router.get("/api/admin/mock-api/endpoints/:id/logs", ...op, async (req, res) => {
    const logs = await listRequestLogsAdmin(mockApiDb, {
      endpointId: req.params.id,
      limit: Math.min(Number(req.query.limit) || 100, 500),
      offset: Number(req.query.offset) || 0,
    });
    res.json({ logs });
  });

  router.post("/api/admin/mock-api/endpoints/:id/pause", ...op, async (req, res) => {
    const endpoint = await getEndpointByIdAdmin(mockApiDb, req.params.id);
    await markEndpointStatusAdmin(mockApiDb, { id: req.params.id, status: "archived", updatedAt: Date.now() });
    await auditService.recordEvent(req, {
      action: "admin_mock_api_pause",
      feature: "admin",
      metaJson: { endpointId: req.params.id, slug: endpoint?.endpointSlug, owner: endpoint?.ownerUserpart },
    });
    res.json({ ok: true });
  });

  router.post("/api/admin/mock-api/endpoints/:id/activate", ...op, async (req, res) => {
    const endpoint = await getEndpointByIdAdmin(mockApiDb, req.params.id);
    await markEndpointStatusAdmin(mockApiDb, { id: req.params.id, status: "active", updatedAt: Date.now() });
    await auditService.recordEvent(req, {
      action: "admin_mock_api_activate",
      feature: "admin",
      metaJson: { endpointId: req.params.id, slug: endpoint?.endpointSlug, owner: endpoint?.ownerUserpart },
    });
    res.json({ ok: true });
  });

  router.delete("/api/admin/mock-api/endpoints/:id", ...op, async (req, res) => {
    const endpoint = await getEndpointByIdAdmin(mockApiDb, req.params.id);
    await markEndpointStatusAdmin(mockApiDb, { id: req.params.id, status: "deleted", updatedAt: Date.now() });
    await auditService.recordEvent(req, {
      action: "admin_mock_api_delete",
      feature: "admin",
      metaJson: { endpointId: req.params.id, slug: endpoint?.endpointSlug, owner: endpoint?.ownerUserpart },
    });
    res.json({ ok: true });
  });

  router.get("/api/admin/mock-api/abuse-summary", ...op, async (_req, res) => {
    const endpoints = await listAllEndpoints(mockApiDb, { limit: 500 });
    const ranked = await Promise.all(
      endpoints.map(async (ep) => ({
        id: ep.id,
        slug: ep.endpointSlug,
        ownerUserpart: ep.ownerUserpart,
        orgId: ep.ownerOrgId,
        stats24h: await getEndpointStats24h(mockApiDb, ep.id),
      }))
    );
    ranked.sort((a, b) => (b.stats24h.calls24h || 0) - (a.stats24h.calls24h || 0));
    res.json({ topByCalls: ranked.slice(0, 10), topByBytes: [...ranked].sort((a, b) => (b.stats24h.responseBytes24h || 0) - (a.stats24h.responseBytes24h || 0)).slice(0, 10) });
  });

  router.get("/api/admin/jobs", ...op, async (_req, res) => {
    const jobNames = ["presence_snapshot", "platform_snapshot", "storage_snapshot", "lifecycle_purge", "sqlite_backup", "mock_api_purge"];
    const jobs = await Promise.all(
      jobNames.map(async (jobName) => {
        const last = await getLastJobRun(adminDb, jobName);
        return { jobName, last };
      })
    );
    res.json({ jobs });
  });

  router.get("/api/admin/backups", ...op, async (req, res) => {
    const runs = await listBackupRuns(adminDb, { limit: Number(req.query.limit) || 20 });
    res.json({ runs });
  });

  router.post("/api/admin/backups/run", ...op, async (req, res) => {
    const result = await runBackup({ insertBackupRun, adminDb });
    await auditService.recordEvent(req, { action: "admin_backup_run", feature: "admin", status: "success" });
    res.json(result);
  });

  router.get("/api/admin/maintenance", ...op, async (_req, res) => {
    const mode = await getMaintenanceMode(adminDb);
    res.json(mode);
  });

  router.post("/api/admin/maintenance", ...op, async (req, res) => {
    const mode = req.body?.mode;
    if (!["off", "read_only", "drain"].includes(mode)) {
      return res.status(400).json({ error: "mode must be off, read_only, or drain" });
    }
    await setMaintenanceMode(adminDb, { mode, updatedBy: req.genesysCredentials?.userId || "operator" });
    await auditService.recordEvent(req, { action: "admin_maintenance_mode", feature: "admin", metaJson: { mode } });
    res.json({ mode });
  });

  router.post("/api/admin/snapshots/run", ...op, async (req, res) => {
    const type = req.body?.type || "all";
    const results = {};
    if (type === "all" || type === "presence") results.presence = await takePresenceSnapshot();
    if (type === "all" || type === "storage") results.storage = await takeStorageSnapshot();
    if (type === "all" || type === "platform") results.platform = await takePlatformSnapshot();
    res.json(results);
  });

  return router;
};

export { createAdminRouter };
