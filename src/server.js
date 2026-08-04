import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createGenesysRouter } from "./routes/genesys.js";
import { createLogsRouter } from "./routes/logs.js";
import { createSessionRouter } from "./routes/session.js";
import { ensureSessionMiddleware } from "./middleware/session.js";
import { initDb, getLogs as dbGetLogs, getLogById as dbGetLogById } from "./data/db.js";
import { initSessionDb } from "./data/session-db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const app = express();
const port = process.env.PORT || 3000;
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "50mb";

app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.static(path.join(projectRoot, "public")));
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

  app.use(ensureSessionMiddleware);

  app.use(
    "/",
    createLogsRouter({
      getLogs: () => dbGetLogs(db),
      getLogById: (id) => dbGetLogById(db, id),
    })
  );
  app.use("/", createSessionRouter({ sessionDb }));
  app.use("/", createGenesysRouter());

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
