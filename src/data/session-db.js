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

        CREATE TABLE IF NOT EXISTS credential_vault (
          link_id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          org_name TEXT,
          third_party_org_name TEXT,
          region TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_name TEXT,
          user_display_name TEXT,
          encrypted_token TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          revoked INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS session_credentials (
          session_id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          org_name TEXT,
          third_party_org_name TEXT,
          region TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_name TEXT,
          user_display_name TEXT,
          encrypted_token TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS launch_codes (
          code TEXT PRIMARY KEY,
          link_id TEXT NOT NULL,
          feature TEXT NOT NULL,
          params_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          consumed INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_launch_codes_link_id
          ON launch_codes (link_id);
      `);

      try {
        await db.exec(`ALTER TABLE user_sync ADD COLUMN expand_profile TEXT`);
      } catch (_error) {
        // Column already exists.
      }

      try {
        await db.exec(`ALTER TABLE session_connections ADD COLUMN last_seen_at INTEGER`);
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
    `SELECT session_id AS sessionId, org_id AS orgId, org_name AS orgName, region,
            connected_at AS connectedAt, last_seen_at AS lastSeenAt
     FROM session_connections
     WHERE session_id = ?`,
    sessionId
  );

const touchSessionActivity = async (db, sessionId) => {
  const now = Date.now();
  await db.run(
    `UPDATE session_connections SET last_seen_at = ? WHERE session_id = ?`,
    now,
    sessionId
  );
  return now;
};

const bindSessionConnection = async (db, { sessionId, orgId, orgName, region }) => {
  const existing = await getSessionConnection(db, sessionId);

  if (existing && existing.orgId !== orgId) {
    await clearSessionData(db, sessionId);
  }

  const connectedAt = Date.now();
  await db.run(
    `INSERT INTO session_connections (session_id, org_id, org_name, region, connected_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       org_id = excluded.org_id,
       org_name = excluded.org_name,
       region = excluded.region,
       connected_at = excluded.connected_at,
       last_seen_at = excluded.last_seen_at`,
    sessionId,
    orgId,
    orgName ?? null,
    region ?? null,
    connectedAt,
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
  await db.run(`DELETE FROM session_credentials WHERE session_id = ?`, sessionId);
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

const upsertCredentialVault = async (
  db,
  {
    linkId,
    orgId,
    orgName,
    thirdPartyOrgName,
    region,
    userId,
    userName,
    userDisplayName,
    encryptedToken,
    expiresAt,
  }
) => {
  const now = Date.now();
  await db.run(
    `INSERT INTO credential_vault (
      link_id, org_id, org_name, third_party_org_name, region, user_id, user_name, user_display_name,
      encrypted_token, created_at, expires_at, revoked
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(link_id) DO UPDATE SET
      org_id = excluded.org_id,
      org_name = excluded.org_name,
      third_party_org_name = excluded.third_party_org_name,
      region = excluded.region,
      user_id = excluded.user_id,
      user_name = excluded.user_name,
      user_display_name = excluded.user_display_name,
      encrypted_token = excluded.encrypted_token,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at,
      revoked = 0`,
    linkId,
    orgId,
    orgName ?? null,
    thirdPartyOrgName ?? null,
    region,
    userId,
    userName ?? null,
    userDisplayName ?? null,
    encryptedToken,
    now,
    expiresAt
  );
};

const getCredentialVault = async (db, linkId) =>
  db.get(
    `SELECT link_id AS linkId, org_id AS orgId, org_name AS orgName, third_party_org_name AS thirdPartyOrgName,
            region, user_id AS userId, user_name AS userName, user_display_name AS userDisplayName,
            encrypted_token AS encryptedToken, created_at AS createdAt, expires_at AS expiresAt, revoked
     FROM credential_vault
     WHERE link_id = ?`,
    linkId
  );

const revokeCredentialVault = async (db, linkId) => {
  await db.run(`UPDATE credential_vault SET revoked = 1 WHERE link_id = ?`, linkId);
};

const upsertSessionCredentials = async (
  db,
  {
    sessionId,
    orgId,
    orgName,
    thirdPartyOrgName,
    region,
    userId,
    userName,
    userDisplayName,
    encryptedToken,
    expiresAt,
  }
) => {
  const now = Date.now();
  await db.run(
    `INSERT INTO session_credentials (
      session_id, org_id, org_name, third_party_org_name, region, user_id, user_name, user_display_name,
      encrypted_token, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      org_id = excluded.org_id,
      org_name = excluded.org_name,
      third_party_org_name = excluded.third_party_org_name,
      region = excluded.region,
      user_id = excluded.user_id,
      user_name = excluded.user_name,
      user_display_name = excluded.user_display_name,
      encrypted_token = excluded.encrypted_token,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at`,
    sessionId,
    orgId,
    orgName ?? null,
    thirdPartyOrgName ?? null,
    region,
    userId,
    userName ?? null,
    userDisplayName ?? null,
    encryptedToken,
    now,
    expiresAt
  );
};

const getSessionCredentials = async (db, sessionId) =>
  db.get(
    `SELECT session_id AS sessionId, org_id AS orgId, org_name AS orgName, third_party_org_name AS thirdPartyOrgName,
            region, user_id AS userId, user_name AS userName, user_display_name AS userDisplayName,
            encrypted_token AS encryptedToken, created_at AS createdAt, expires_at AS expiresAt
     FROM session_credentials
     WHERE session_id = ?`,
    sessionId
  );

const clearSessionCredentials = async (db, sessionId) => {
  await db.run(`DELETE FROM session_credentials WHERE session_id = ?`, sessionId);
};

const createLaunchCode = async (
  db,
  { code, linkId, feature, paramsJson, expiresAt }
) => {
  const now = Date.now();
  await db.run(
    `INSERT INTO launch_codes (code, link_id, feature, params_json, created_at, expires_at, consumed)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    code,
    linkId,
    feature,
    paramsJson,
    now,
    expiresAt
  );
};

const consumeLaunchCode = async (db, code) => {
  const row = await db.get(
    `SELECT code, link_id AS linkId, feature, params_json AS paramsJson, created_at AS createdAt,
            expires_at AS expiresAt, consumed
     FROM launch_codes
     WHERE code = ?`,
    code
  );

  if (!row || row.consumed) {
    return null;
  }

  if (Date.now() > row.expiresAt) {
    return null;
  }

  await db.run(`UPDATE launch_codes SET consumed = 1 WHERE code = ?`, code);
  return row;
};

const ACTIVITY_WINDOW_MS = 15 * 60 * 1000;

const getConnectedUsers = async (db) => {
  const now = Date.now();
  const vaultRows = await db.all(
    `SELECT session_id AS sessionId, org_id AS orgId, org_name AS orgName, region,
            user_id AS userId, user_name AS userName, user_display_name AS userDisplayName,
            created_at AS connectedAt, expires_at AS expiresAt, 'vault' AS authMode,
            created_at AS lastSeenAt
     FROM session_credentials
     WHERE expires_at > ?`,
    now
  );

  const connectionRows = await db.all(
    `SELECT sc.session_id AS sessionId, sc.org_id AS orgId, sc.org_name AS orgName, sc.region,
            sc.connected_at AS connectedAt, sc.last_seen_at AS lastSeenAt
     FROM session_connections sc
     LEFT JOIN session_credentials cred ON cred.session_id = sc.session_id AND cred.expires_at > ?
     WHERE cred.session_id IS NULL
       AND sc.last_seen_at IS NOT NULL
       AND sc.last_seen_at > ?`,
    now,
    now - ACTIVITY_WINDOW_MS
  );

  const manual = connectionRows.map((row) => ({
    ...row,
    userId: null,
    userName: null,
    userDisplayName: null,
    authMode: "manual",
    expiresAt: null,
  }));

  return [...vaultRows, ...manual];
};

const purgeExpiredSessionCredentials = async (db) => {
  const now = Date.now();
  const expired = await db.all(
    `SELECT session_id AS sessionId FROM session_credentials WHERE expires_at <= ?`,
    now
  );
  for (const row of expired) {
    await clearSessionCredentials(db, row.sessionId);
    await db.run(`DELETE FROM session_connections WHERE session_id = ?`, row.sessionId);
  }

  const staleCutoff = now - ACTIVITY_WINDOW_MS;
  const staleResult = await db.run(
    `DELETE FROM session_connections
     WHERE (last_seen_at IS NULL OR last_seen_at < ?)
       AND session_id NOT IN (
         SELECT session_id FROM session_credentials WHERE expires_at > ?
       )`,
    staleCutoff,
    now
  );

  return (expired.length || 0) + (staleResult.changes || 0);
};

const listActiveSessionCredentials = async (db) => {
  const now = Date.now();
  return db.all(
    `SELECT session_id AS sessionId, org_id AS orgId, org_name AS orgName, region,
            user_id AS userId, user_name AS userName, user_display_name AS userDisplayName,
            created_at AS createdAt, expires_at AS expiresAt
     FROM session_credentials
     WHERE expires_at > ?
     ORDER BY created_at DESC`,
    now
  );
};

const listActiveCredentialVault = async (db) => {
  const now = Date.now();
  return db.all(
    `SELECT link_id AS linkId, org_id AS orgId, org_name AS orgName, region,
            user_id AS userId, user_name AS userName, user_display_name AS userDisplayName,
            created_at AS createdAt, expires_at AS expiresAt, revoked
     FROM credential_vault
     WHERE revoked = 0 AND expires_at > ?
     ORDER BY created_at DESC`,
    now
  );
};

const purgeExpiredVaultEntries = async (db) => {
  const now = Date.now();
  const result = await db.run(
    `DELETE FROM credential_vault WHERE expires_at < ? OR revoked = 1`,
    now
  );
  return result.changes || 0;
};

const purgeConsumedLaunchCodes = async (db, { olderThanMs = 24 * 60 * 60 * 1000 } = {}) => {
  const cutoff = Date.now() - olderThanMs;
  const result = await db.run(
    `DELETE FROM launch_codes WHERE consumed = 1 AND created_at < ?`,
    cutoff
  );
  return result.changes || 0;
};

const purgeOldExportData = async (db, { olderThanMs = 30 * 24 * 60 * 60 * 1000 } = {}) => {
  const cutoff = Date.now() - olderThanMs;
  const exports = await db.all(
    `SELECT id FROM export_results WHERE updated_at < ?`,
    cutoff
  );
  for (const entry of exports) {
    await db.run(`DELETE FROM export_rows WHERE export_id = ?`, entry.id);
  }
  const result = await db.run(`DELETE FROM export_results WHERE updated_at < ?`, cutoff);
  return result.changes || 0;
};

const revokeSessionById = async (db, sessionId) => {
  await clearSessionCredentials(db, sessionId);
  await clearSessionData(db, sessionId);
};

export {
  bindSessionConnection,
  clearCachedUsers,
  clearSessionCredentials,
  clearSessionData,
  consumeLaunchCode,
  createLaunchCode,
  getAllExportRows,
  getCachedUsers,
  getConnectedUsers,
  getCredentialVault,
  getExportRows,
  getSessionConnection,
  getSessionCredentials,
  getUserSyncState,
  initSessionDb,
  insertCachedUsers,
  listActiveSessionCredentials,
  listActiveCredentialVault,
  purgeExpiredSessionCredentials,
  purgeConsumedLaunchCodes,
  purgeExpiredVaultEntries,
  purgeOldExportData,
  revokeCredentialVault,
  revokeSessionById,
  saveExportResult,
  sessionDbPath,
  setUserSyncState,
  touchSessionActivity,
  upsertCredentialVault,
  upsertSessionCredentials,
};
