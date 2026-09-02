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
import { ensureSessionMiddleware } from "./middleware/session.js";
import { createVaultCredentialsMiddleware } from "./middleware/vault-credentials.js";
import { createLaunchRouter } from "./routes/launch.js";
import { initDb, getLogs as dbGetLogs, getLogById as dbGetLogById } from "./data/db.js";
import { initSessionDb } from "./data/session-db.js";
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
} from "./data/mock-api-db.js";
import { createMockApiService } from "./lib/mock-api.js";
import { MOCK_API_CONFIG } from "./lib/mock-api-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const app = express();
const port = process.env.PORT || 3000;
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "50mb";
const mockRequestBodyLimit = String(MOCK_API_CONFIG.maxRequestBodyBytes);

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
  });

  app.use(
    createMockApiPublicRouter({
      mockApiService,
      requestBodyLimit: mockRequestBodyLimit,
    })
  );

  app.use(ensureSessionMiddleware);
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/launch") && req.method !== "GET") {
      return express.json({ limit: "4kb" })(req, res, next);
    }
    next();
  });
  app.use(createLaunchRouter({ sessionDb }));
  app.use(express.json({ limit: jsonBodyLimit }));
  app.use(createVaultCredentialsMiddleware(sessionDb));

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

  setInterval(() => {
    mockApiService.refreshLifecycle().catch((error) => {
      console.error("Mock API lifecycle refresh failed:", error.message);
    });
  }, MOCK_API_CONFIG.purgeIntervalMs).unref();

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
