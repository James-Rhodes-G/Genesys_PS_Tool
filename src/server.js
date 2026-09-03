import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createGenesysRouter } from "./routes/genesys.js";
import { createLogsRouter } from "./routes/logs.js";
import { createSessionRouter } from "./routes/session.js";
import {
  createMockApiManagementRouter,
  createMockApiPublicRouter,
} from "./routes/mock-api.js";
import { createAdminRouter } from "./routes/admin.js";
import { createHealthRouter } from "./routes/health.js";
import { ensureSessionMiddleware } from "./middleware/session.js";
import { createVaultCredentialsMiddleware } from "./middleware/vault-credentials.js";
import { createLaunchRouter } from "./routes/launch.js";
import { initDb, getLogs as dbGetLogs, getLogById as dbGetLogById } from "./data/db.js";
import {
  initSessionDb,
  getSessionConnection,
  getConnectedUsers,
  listActiveSessionCredentials,
  listActiveCredentialVault,
  revokeSessionById,
  revokeCredentialVault,
  clearSessionCredentials,
  touchSessionActivity,
  purgeExpiredVaultEntries,
  purgeExpiredSessionCredentials,
  purgeConsumedLaunchCodes,
  purgeOldExportData,
} from "./data/session-db.js";
import {
  initMockApiDb,
  insertEndpoint,
  updateEndpoint,
  getEndpointById,
  getEndpointForInvocation,
  listEndpoints,
  countActiveEndpoints,
  markEndpointStatus,
  recordEndpointUsage,
  insertRequestLog,
  trimRequestLogs,
  listRequestLogs,
  getRequestLogById,
  purgeDeletedEndpoints,
  purgeArchivedEndpoints,
  expireStaleActiveEndpoints,
  recordHourlyStats,
  listAllEndpoints,
  getEndpointByIdAdmin,
  markEndpointStatusAdmin,
  getEndpointStats24h,
  getGlobalMockApiTraffic,
  listHourlyTraffic,
  listRequestLogsAdmin,
} from "./data/mock-api-db.js";
import {
  initAdminDb,
  insertAdminEvent,
  listAdminEvents,
  countAdminEvents,
  insertAdminActivity,
  listAdminActivity,
  insertPresenceSnapshot,
  listPresenceSnapshots,
  insertStorageSnapshot,
  listStorageSnapshots,
  insertPlatformSnapshot,
  listPlatformSnapshots,
  recordRouteStats,
  listRouteStats,
  listAggregatedRouteStats,
  countAggregatedRouteStats,
  insertBackupRun,
  listBackupRuns,
  insertJobRun,
  getLastJobRun,
  listJobRuns,
  getMaintenanceMode,
  setMaintenanceMode,
} from "./data/admin-db.js";
import { createMockApiService } from "./lib/mock-api.js";
import { MOCK_API_CONFIG } from "./lib/mock-api-config.js";
import { createAuditService } from "./lib/admin-audit.js";
import { createRequestIdMiddleware, createRequestLoggerMiddleware } from "./lib/structured-log.js";
import { createMaintenanceMiddleware, setModeProvider } from "./lib/maintenance-mode.js";
import { createCoreApiMetricsMiddleware } from "./lib/core-api-metrics.js";
import { createPreventionMiddleware } from "./lib/admin-prevention.js";
import { createAdminJobs } from "./lib/admin-jobs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const app = express();
const port = process.env.PORT || 3000;
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "50mb";
const mockRequestBodyLimit = String(MOCK_API_CONFIG.maxRequestBodyBytes);

app.set("trust proxy", 1);
app.use(express.static(path.join(projectRoot, "public")));
app.get("/js/shared/flow-execution-analysis.js", (_req, res) => {
  res.sendFile(path.join(projectRoot, "src", "lib", "flow-execution-analysis.js"));
});
app.get("/favicon.ico", (_req, res) => {
  res.redirect(302, "/favicon.svg");
});
app.get("/notification-message-parser", (_req, res) => {
  res.sendFile(path.join(projectRoot, "public", "notification-message-parser.html"));
});
app.use(
  "/spark",
  express.static(path.join(projectRoot, "node_modules", "genesys-spark", "dist"))
);

const start = async () => {
  const db = await initDb();
  const sessionDb = await initSessionDb();
  const mockApiDb = await initMockApiDb();
  const adminDb = await initAdminDb();

  setModeProvider(() => getMaintenanceMode(adminDb));

  const auditService = createAuditService({
    adminDb,
    insertAdminEvent,
    insertAdminActivity,
  });

  const mockApiService = createMockApiService({
    db: mockApiDb,
    insertEndpoint,
    updateEndpoint,
    getEndpointById,
    getEndpointForInvocation,
    listEndpoints,
    countActiveEndpoints,
    markEndpointStatus,
    recordEndpointUsage,
    insertRequestLog,
    trimRequestLogs,
    listRequestLogs,
    getRequestLogById,
    purgeDeletedEndpoints,
    purgeArchivedEndpoints,
    expireStaleActiveEndpoints,
    recordHourlyStats,
  });

  const purgeExpiredData = async () => {
    let total = 0;
    total += await purgeExpiredVaultEntries(sessionDb);
    total += await purgeExpiredSessionCredentials(sessionDb);
    total += await purgeConsumedLaunchCodes(sessionDb);
    total += await purgeOldExportData(sessionDb);
    return total;
  };

  const adminJobs = createAdminJobs({
    adminDb,
    sessionDb,
    mockApiDb,
    insertPresenceSnapshot,
    insertStorageSnapshot,
    insertPlatformSnapshot,
    insertJobRun,
    insertBackupRun,
    getConnectedUsers,
    purgeExpiredSessionCredentials,
    purgeExpiredData,
    purgeMockApiDeleted: async () => {
      const now = Date.now();
      const retention = MOCK_API_CONFIG.retentionExpiredMs;
      return (
        (await purgeDeletedEndpoints(mockApiDb, { beforeTimestamp: now - retention })) +
        (await purgeArchivedEndpoints(mockApiDb, { beforeTimestamp: now - retention }))
      );
    },
  });

  const prevention = createPreventionMiddleware({ sessionDb, getSessionConnection });

  app.use(createRequestIdMiddleware());
  app.use(createRequestLoggerMiddleware());
  app.use(createHealthRouter({ sessionDb, adminDb, getMaintenanceModeFromDb: getMaintenanceMode }));

  app.use(
    createMockApiPublicRouter({
      mockApiService,
      requestBodyLimit: mockRequestBodyLimit,
    })
  );

  app.use(ensureSessionMiddleware);
  app.use(createMaintenanceMiddleware());
  app.use((req, res, next) => {
    if (req.sessionId && (req.path.startsWith("/api/genesys/") || req.path.startsWith("/api/session/"))) {
      touchSessionActivity(sessionDb, req.sessionId).catch(() => {});
    }
    next();
  });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/launch") && req.method !== "GET") {
      return express.json({ limit: "4kb" })(req, res, next);
    }
    next();
  });
  app.use(createLaunchRouter({
    sessionDb,
    recordEvent: (req, payload) => auditService.recordEvent(req, payload),
  }));
  app.use(express.json({ limit: jsonBodyLimit }));
  app.use(createVaultCredentialsMiddleware(sessionDb));
  app.use(auditService.createAuditMiddleware());
  app.use(createCoreApiMetricsMiddleware({ recordRouteStats, adminDb }));
  app.use(prevention.validateOrgBind);
  app.use(prevention.enforceAuthorizedOrgs);
  app.use(prevention.rateLimitGenesysMutations);
  app.use(prevention.blockDangerousInMaintenance);

  app.use(
    "/",
    createLogsRouter({
      getLogs: () => dbGetLogs(db),
      getLogById: (id) => dbGetLogById(db, id),
    })
  );
  app.use("/", createSessionRouter({ sessionDb }));
  app.use("/", createGenesysRouter());
  app.use(
    "/",
    createMockApiManagementRouter({
      mockApiService,
      sessionDb,
    })
  );
  app.use(
    "/",
    createAdminRouter({
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
      takePresenceSnapshot: adminJobs.takePresenceSnapshot,
      takeStorageSnapshot: adminJobs.takeStorageSnapshot,
      takePlatformSnapshot: adminJobs.takePlatformSnapshot,
    })
  );

  setInterval(() => {
    mockApiService.refreshLifecycle().catch((error) => {
      console.error("Mock API lifecycle refresh failed:", error.message);
    });
  }, MOCK_API_CONFIG.purgeIntervalMs).unref();

  adminJobs.startJobs();

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
