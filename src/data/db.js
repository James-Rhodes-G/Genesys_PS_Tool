import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const dbPath = path.join(projectRoot, "data", "logs.db");

const initDb = async () => {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      title TEXT,
      summary TEXT,
      output TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  return db;
};

const getLogs = async (db) => {
  return db.all(
    `SELECT id, title, summary, output, updated_at AS updatedAt
     FROM logs
     ORDER BY updated_at DESC`
  );
};

const getLogById = async (db, id) => {
  return db.get(
    `SELECT id, title, summary, output, updated_at AS updatedAt
     FROM logs
     WHERE id = ?`,
    id
  );
};

const upsertLog = async (db, log) => {
  const updatedAt = log.updatedAt ?? Date.now();
  await db.run(
    `INSERT INTO logs (id, title, summary, output, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       summary = excluded.summary,
       output = excluded.output,
       updated_at = excluded.updated_at`,
    log.id,
    log.title ?? null,
    log.summary ?? null,
    log.output,
    updatedAt
  );
};

const clearLogs = async (db) => {
  await db.run("DELETE FROM logs");
};

export { initDb, getLogs, getLogById, upsertLog, clearLogs, dbPath };
