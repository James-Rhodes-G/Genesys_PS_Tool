import { initDb, upsertLog, clearLogs, dbPath } from "../src/data/db.js";

const now = Date.now();
const seed = [
  {
    id: "startup",
    title: "Startup Sequence",
    summary: "Boot log from latest run.",
    updatedAt: now,
    output: `Booting service...\nLoading config...\nConnected to DB.\nReady.`,
  },
  {
    id: "job-42",
    title: "Batch Job 42",
    summary: "ETL job status output.",
    updatedAt: now - 1000 * 60 * 45,
    output: `Job 42 started.\nPulling records...\nTransformed 1,204 rows.\nCompleted with warnings.`,
  },
  {
    id: "alerts",
    title: "Alert Feed",
    summary: "Most recent alerts captured.",
    updatedAt: now - 1000 * 60 * 120,
    output: `WARN: Cache miss spike detected.\nINFO: Autoscaling triggered.\nOK: Recovery stabilized.`,
  },
];

const db = await initDb();
await clearLogs(db);
for (const log of seed) {
  await upsertLog(db, log);
}

console.log(`Seeded ${seed.length} logs -> ${dbPath}`);
