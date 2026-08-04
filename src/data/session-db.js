import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const sessionDbPath = path.join(projectRoot, "data", "session.db");

let sessionDbPromise;

const initSessionDb = async () => {
  if (!sessionDbPromise) {
    sessionDbPromise = open({
      filename: sessionDbPath,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS session_connections (
          session_id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          org_name TEXT,
          region TEXT,
          connected_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS export_results (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          org_id TEXT NOT NULL,
          export_type TEXT,
          title TEXT,
          status TEXT,
          meta_json TEXT NOT NULL,
          row_count INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS export_rows (
          export_id TEXT NOT NULL,
          row_index INTEGER NOT NULL,
          row_json TEXT NOT NULL,
          PRIMARY KEY (export_id, row_index)
        );

        CREATE INDEX IF NOT EXISTS idx_export_results_session_org
          ON export_results (session_id, org_id);

        CREATE INDEX IF NOT EXISTS idx_export_rows_export_id
          ON export_rows (export_id);

        CREATE TABLE IF NOT EXISTS user_sync (
          session_id TEXT NOT NULL,
          org_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'idle',
          user_count INTEGER NOT NULL DEFAULT 0,
          synced_count INTEGER NOT NULL DEFAULT 0,
          synced_at INTEGER,
          error_message TEXT,
          PRIMARY KEY (session_id, org_id)
        );

        CREATE TABLE IF NOT EXISTS cached_users (
          session_id TEXT NOT NULL,
          org_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          row_json TEXT NOT NULL,
          PRIMARY KEY (session_id, org_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_cached_users_session_org
          ON cached_users (session_id, org_id);
      `);

      try {
        await db.exec(`ALTER TABLE user_sync ADD COLUMN expand_profile TEXT`);
      } catch (_error) {
        // Column already exists.
      }

      return db;
    });
  }

  return sessionDbPromise;
};

const getSessionConnection = async (db, sessionId) =>
  db.get(
    `SELECT session_id AS sessionId, org_id AS orgId, org_name AS orgName, region, connected_at AS connectedAt
     FROM session_connections
     WHERE session_id = ?`,
    sessionId
  );

const bindSessionConnection = async (db, { sessionId, orgId, orgName, region }) => {
  const existing = await getSessionConnection(db, sessionId);

  if (existing && existing.orgId !== orgId) {
    await clearSessionData(db, sessionId);
  }

  const connectedAt = Date.now();
  await db.run(
    `INSERT INTO session_connections (session_id, org_id, org_name, region, connected_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       org_id = excluded.org_id,
       org_name = excluded.org_name,
       region = excluded.region,
       connected_at = excluded.connected_at`,
    sessionId,
    orgId,
    orgName ?? null,
    region ?? null,
    connectedAt
  );

  return { sessionId, orgId, orgName, region, connectedAt };
};

const clearSessionData = async (db, sessionId) => {
  const exports = await db.all(`SELECT id FROM export_results WHERE session_id = ?`, sessionId);

  for (const entry of exports) {
    await db.run(`DELETE FROM export_rows WHERE export_id = ?`, entry.id);
  }

  await db.run(`DELETE FROM export_results WHERE session_id = ?`, sessionId);
  await db.run(`DELETE FROM cached_users WHERE session_id = ?`, sessionId);
  await db.run(`DELETE FROM user_sync WHERE session_id = ?`, sessionId);
  await db.run(`DELETE FROM session_connections WHERE session_id = ?`, sessionId);
};

const getUserSyncState = async (db, { sessionId, orgId }) =>
  db.get(
    `SELECT session_id AS sessionId,
            org_id AS orgId,
            status,
            user_count AS userCount,
            synced_count AS syncedCount,
            synced_at AS syncedAt,
            error_message AS errorMessage,
            expand_profile AS expandProfile
     FROM user_sync
     WHERE session_id = ? AND org_id = ?`,
    sessionId,
    orgId
  );

const setUserSyncState = async (
  db,
  {
    sessionId,
    orgId,
    status,
    userCount = 0,
    syncedCount = 0,
    syncedAt = null,
    errorMessage = null,
    expandProfile = null,
  }
) => {
  await db.run(
    `INSERT INTO user_sync (session_id, org_id, status, user_count, synced_count, synced_at, error_message, expand_profile)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id, org_id) DO UPDATE SET
       status = excluded.status,
       user_count = excluded.user_count,
       synced_count = excluded.synced_count,
       synced_at = excluded.synced_at,
       error_message = excluded.error_message,
       expand_profile = excluded.expand_profile`,
    sessionId,
    orgId,
    status,
    userCount,
    syncedCount,
    syncedAt,
    errorMessage,
    expandProfile
  );
};

const clearCachedUsers = async (db, { sessionId, orgId }) => {
  await db.run(`DELETE FROM cached_users WHERE session_id = ? AND org_id = ?`, sessionId, orgId);
};

const insertCachedUsers = async (db, { sessionId, orgId, users }) => {
  if (!Array.isArray(users) || users.length === 0) {
    return 0;
  }

  let inserted = 0;
  for (const user of users) {
    const userId = String(user?.id || "").trim();
    if (!userId) {
      continue;
    }

    await db.run(
      `INSERT INTO cached_users (session_id, org_id, user_id, row_json) VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id, org_id, user_id) DO UPDATE SET row_json = excluded.row_json`,
      sessionId,
      orgId,
      userId,
      JSON.stringify(user)
    );
    inserted += 1;
  }

  return inserted;
};

const getCachedUsers = async (db, { sessionId, orgId }) => {
  const rows = await db.all(
    `SELECT row_json AS rowJson
     FROM cached_users
     WHERE session_id = ? AND org_id = ?
     ORDER BY user_id ASC`,
    sessionId,
    orgId
  );

  return rows.map((entry) => JSON.parse(entry.rowJson));
};

const saveExportResult = async (
  db,
  { sessionId, orgId, exportId, exportType, title, status, meta, rows = [] }
) => {
  const now = Date.now();
  const metaJson = JSON.stringify(meta ?? {});
  const rowList = Array.isArray(rows) ? rows : [];

  await db.run(`DELETE FROM export_rows WHERE export_id = ?`, exportId);
  await db.run(
    `INSERT INTO export_results (id, session_id, org_id, export_type, title, status, meta_json, row_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       session_id = excluded.session_id,
       org_id = excluded.org_id,
       export_type = excluded.export_type,
       title = excluded.title,
       status = excluded.status,
       meta_json = excluded.meta_json,
       row_count = excluded.row_count,
       updated_at = excluded.updated_at`,
    exportId,
    sessionId,
    orgId,
    exportType ?? null,
    title ?? null,
    status ?? null,
    metaJson,
    rowList.length,
    now,
    now
  );

  if (rowList.length === 0) {
    return { exportId, rowCount: 0 };
  }

  await db.run("BEGIN");
  try {
    for (let index = 0; index < rowList.length; index += 1) {
      await db.run(
        `INSERT INTO export_rows (export_id, row_index, row_json) VALUES (?, ?, ?)`,
        exportId,
        index,
        JSON.stringify(rowList[index])
      );
    }
    await db.run("COMMIT");
  } catch (error) {
    await db.run("ROLLBACK");
    throw error;
  }

  return { exportId, rowCount: rowList.length };
};

const getExportRows = async (db, { exportId, sessionId, orgId, offset = 0, limit = 100 }) => {
  const exportResult = await db.get(
    `SELECT id, row_count AS rowCount
     FROM export_results
     WHERE id = ? AND session_id = ? AND org_id = ?`,
    exportId,
    sessionId,
    orgId
  );

  if (!exportResult) {
    return null;
  }

  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 1000);

  const rowEntries = await db.all(
    `SELECT row_json AS rowJson
     FROM export_rows
     WHERE export_id = ?
     ORDER BY row_index ASC
     LIMIT ? OFFSET ?`,
    exportId,
    safeLimit,
    safeOffset
  );

  return {
    exportId,
    rowCount: exportResult.rowCount,
    offset: safeOffset,
    limit: safeLimit,
    rows: rowEntries.map((entry) => JSON.parse(entry.rowJson)),
  };
};

const getAllExportRows = async (db, { exportId, sessionId, orgId }) => {
  const exportResult = await db.get(
    `SELECT id, row_count AS rowCount
     FROM export_results
     WHERE id = ? AND session_id = ? AND org_id = ?`,
    exportId,
    sessionId,
    orgId
  );

  if (!exportResult) {
    return null;
  }

  const rowEntries = await db.all(
    `SELECT row_json AS rowJson
     FROM export_rows
     WHERE export_id = ?
     ORDER BY row_index ASC`,
    exportId
  );

  return {
    exportId,
    rowCount: exportResult.rowCount,
    rows: rowEntries.map((entry) => JSON.parse(entry.rowJson)),
  };
};

export {
  bindSessionConnection,
  clearCachedUsers,
  clearSessionData,
  getAllExportRows,
  getCachedUsers,
  getExportRows,
  getSessionConnection,
  getUserSyncState,
  initSessionDb,
  insertCachedUsers,
  saveExportResult,
  sessionDbPath,
  setUserSyncState,
};
