import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminDbPath = path.resolve(__dirname, "../../data/admin.db");

let adminDbPromise;

const mapEventRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    timestamp: row.timestamp,
    sessionId: row.session_id,
    orgId: row.org_id,
    userId: row.user_id,
    userName: row.user_name,
    region: row.region,
    action: row.action,
    feature: row.feature,
    itemCount: row.item_count,
    successCount: row.success_count,
    failureCount: row.failure_count,
    status: row.status,
    ip: row.ip,
    source: row.source,
    errorCode: row.error_code,
    requestId: row.request_id,
    isDangerous: Boolean(row.is_dangerous),
    metaJson: row.meta_json ? JSON.parse(row.meta_json) : {},
  };
};

const initAdminDb = async () => {
  if (!adminDbPromise) {
    adminDbPromise = open({
      filename: adminDbPath,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS admin_events (
          id TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          session_id TEXT,
          org_id TEXT,
          user_id TEXT,
          user_name TEXT,
          region TEXT,
          action TEXT NOT NULL,
          feature TEXT,
          item_count INTEGER NOT NULL DEFAULT 0,
          success_count INTEGER NOT NULL DEFAULT 0,
          failure_count INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'success',
          ip TEXT,
          source TEXT,
          error_code TEXT,
          request_id TEXT,
          is_dangerous INTEGER NOT NULL DEFAULT 0,
          meta_json TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_admin_events_timestamp ON admin_events (timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_admin_events_org ON admin_events (org_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_admin_events_action ON admin_events (action, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_admin_events_dangerous ON admin_events (is_dangerous, timestamp DESC);

        CREATE TABLE IF NOT EXISTS admin_activity (
          id TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          session_id TEXT NOT NULL,
          org_id TEXT,
          user_id TEXT,
          action TEXT NOT NULL,
          affected_count INTEGER NOT NULL DEFAULT 0,
          success_count INTEGER NOT NULL DEFAULT 0,
          failure_count INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_admin_activity_session ON admin_activity (session_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_admin_activity_org ON admin_activity (org_id, timestamp DESC);

        CREATE TABLE IF NOT EXISTS admin_presence_snapshots (
          snapshot_at INTEGER PRIMARY KEY,
          connected_sessions INTEGER NOT NULL DEFAULT 0,
          unique_users INTEGER NOT NULL DEFAULT 0,
          unique_orgs INTEGER NOT NULL DEFAULT 0,
          vault_sessions INTEGER NOT NULL DEFAULT 0,
          oauth_sessions INTEGER NOT NULL DEFAULT 0,
          manual_sessions INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS admin_storage_snapshots (
          snapshot_at INTEGER PRIMARY KEY,
          session_db_bytes INTEGER NOT NULL DEFAULT 0,
          mock_api_db_bytes INTEGER NOT NULL DEFAULT 0,
          logs_db_bytes INTEGER NOT NULL DEFAULT 0,
          admin_db_bytes INTEGER NOT NULL DEFAULT 0,
          table_stats_json TEXT NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS admin_platform_snapshots (
          snapshot_at INTEGER PRIMARY KEY,
          cpu_percent REAL,
          memory_heap_bytes INTEGER,
          memory_rss_bytes INTEGER,
          disk_free_bytes INTEGER,
          event_loop_lag_ms REAL
        );

        CREATE TABLE IF NOT EXISTS admin_route_hourly_stats (
          route_family TEXT NOT NULL,
          hour_start INTEGER NOT NULL,
          call_count INTEGER NOT NULL DEFAULT 0,
          error_count INTEGER NOT NULL DEFAULT 0,
          total_response_time_ms INTEGER NOT NULL DEFAULT 0,
          max_response_time_ms INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (route_family, hour_start)
        );

        CREATE TABLE IF NOT EXISTS admin_backup_runs (
          id TEXT PRIMARY KEY,
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          status TEXT NOT NULL,
          files_json TEXT NOT NULL DEFAULT '[]',
          total_bytes INTEGER NOT NULL DEFAULT 0,
          error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS admin_job_runs (
          id TEXT PRIMARY KEY,
          job_name TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          status TEXT NOT NULL,
          duration_ms INTEGER,
          rows_affected INTEGER NOT NULL DEFAULT 0,
          error_message TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_admin_job_runs_name ON admin_job_runs (job_name, started_at DESC);

        CREATE TABLE IF NOT EXISTS admin_maintenance (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          mode TEXT NOT NULL DEFAULT 'off',
          updated_at INTEGER NOT NULL,
          updated_by TEXT
        );

        INSERT OR IGNORE INTO admin_maintenance (id, mode, updated_at) VALUES (1, 'off', 0);
      `);
      return db;
    });
  }
  return adminDbPromise;
};

const insertAdminEvent = async (db, event) => {
  const id = event.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await db.run(
    `INSERT INTO admin_events (
      id, timestamp, session_id, org_id, user_id, user_name, region,
      action, feature, item_count, success_count, failure_count, status,
      ip, source, error_code, request_id, is_dangerous, meta_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    event.timestamp ?? Date.now(),
    event.sessionId ?? null,
    event.orgId ?? null,
    event.userId ?? null,
    event.userName ?? null,
    event.region ?? null,
    event.action,
    event.feature ?? null,
    event.itemCount ?? 0,
    event.successCount ?? 0,
    event.failureCount ?? 0,
    event.status ?? "success",
    event.ip ?? null,
    event.source ?? "web",
    event.errorCode ?? null,
    event.requestId ?? null,
    event.isDangerous ? 1 : 0,
    JSON.stringify(event.metaJson ?? {})
  );
  return id;
};

const listAdminEvents = async (db, { orgId, userName, action, dangerousOnly, from, to, limit = 100, offset = 0 } = {}) => {
  const conditions = [];
  const params = [];
  if (orgId) {
    conditions.push("(org_id = ? OR org_id LIKE ?)");
    params.push(orgId, `%${orgId}%`);
  }
  if (userName) {
    conditions.push("(user_name LIKE ? OR user_id LIKE ?)");
    params.push(`%${userName}%`, `%${userName}%`);
  }
  if (action) { conditions.push("action = ?"); params.push(action); }
  if (dangerousOnly) { conditions.push("is_dangerous = 1"); }
  if (from) { conditions.push("timestamp >= ?"); params.push(from); }
  if (to) { conditions.push("timestamp <= ?"); params.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await db.all(
    `SELECT * FROM admin_events ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  return rows.map(mapEventRow);
};

const countAdminEvents = async (db, { orgId, userName, dangerousOnly, from, to, action } = {}) => {
  const conditions = [];
  const params = [];
  if (orgId) {
    conditions.push("(org_id = ? OR org_id LIKE ?)");
    params.push(orgId, `%${orgId}%`);
  }
  if (userName) {
    conditions.push("(user_name LIKE ? OR user_id LIKE ?)");
    params.push(`%${userName}%`, `%${userName}%`);
  }
  if (action) { conditions.push("action = ?"); params.push(action); }
  if (dangerousOnly) { conditions.push("is_dangerous = 1"); }
  if (from) { conditions.push("timestamp >= ?"); params.push(from); }
  if (to) { conditions.push("timestamp <= ?"); params.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const row = await db.get(`SELECT COUNT(*) AS count FROM admin_events ${where}`, ...params);
  return row?.count ?? 0;
};

const insertAdminActivity = async (db, activity) => {
  const id = activity.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await db.run(
    `INSERT INTO admin_activity (id, timestamp, session_id, org_id, user_id, action, affected_count, success_count, failure_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    activity.timestamp ?? Date.now(),
    activity.sessionId,
    activity.orgId ?? null,
    activity.userId ?? null,
    activity.action,
    activity.affectedCount ?? 0,
    activity.successCount ?? 0,
    activity.failureCount ?? 0
  );
  return id;
};

const listAdminActivity = async (db, { sessionId, orgId, limit = 50 } = {}) => {
  const conditions = [];
  const params = [];
  if (sessionId) { conditions.push("session_id = ?"); params.push(sessionId); }
  if (orgId) { conditions.push("org_id = ?"); params.push(orgId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await db.all(
    `SELECT * FROM admin_activity ${where} ORDER BY timestamp DESC LIMIT ?`,
    ...params,
    limit
  );
  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    sessionId: row.session_id,
    orgId: row.org_id,
    userId: row.user_id,
    action: row.action,
    affectedCount: row.affected_count,
    successCount: row.success_count,
    failureCount: row.failure_count,
  }));
};

const insertPresenceSnapshot = async (db, snapshot) => {
  await db.run(
    `INSERT OR REPLACE INTO admin_presence_snapshots
     (snapshot_at, connected_sessions, unique_users, unique_orgs, vault_sessions, oauth_sessions, manual_sessions)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    snapshot.snapshotAt,
    snapshot.connectedSessions,
    snapshot.uniqueUsers,
    snapshot.uniqueOrgs,
    snapshot.vaultSessions,
    snapshot.oauthSessions,
    snapshot.manualSessions
  );
};

const listPresenceSnapshots = async (db, { from, to } = {}) => {
  const conditions = [];
  const params = [];
  if (from) { conditions.push("snapshot_at >= ?"); params.push(from); }
  if (to) { conditions.push("snapshot_at <= ?"); params.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.all(`SELECT * FROM admin_presence_snapshots ${where} ORDER BY snapshot_at ASC`, ...params);
};

const insertStorageSnapshot = async (db, snapshot) => {
  await db.run(
    `INSERT OR REPLACE INTO admin_storage_snapshots
     (snapshot_at, session_db_bytes, mock_api_db_bytes, logs_db_bytes, admin_db_bytes, table_stats_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    snapshot.snapshotAt,
    snapshot.sessionDbBytes,
    snapshot.mockApiDbBytes,
    snapshot.logsDbBytes,
    snapshot.adminDbBytes,
    JSON.stringify(snapshot.tableStats ?? {})
  );
};

const listStorageSnapshots = async (db, { from, to } = {}) => {
  const conditions = [];
  const params = [];
  if (from) { conditions.push("snapshot_at >= ?"); params.push(from); }
  if (to) { conditions.push("snapshot_at <= ?"); params.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.all(`SELECT * FROM admin_storage_snapshots ${where} ORDER BY snapshot_at ASC`, ...params);
};

const insertPlatformSnapshot = async (db, snapshot) => {
  await db.run(
    `INSERT OR REPLACE INTO admin_platform_snapshots
     (snapshot_at, cpu_percent, memory_heap_bytes, memory_rss_bytes, disk_free_bytes, event_loop_lag_ms)
     VALUES (?, ?, ?, ?, ?, ?)`,
    snapshot.snapshotAt,
    snapshot.cpuPercent,
    snapshot.memoryHeapBytes,
    snapshot.memoryRssBytes,
    snapshot.diskFreeBytes,
    snapshot.eventLoopLagMs
  );
};

const listPlatformSnapshots = async (db, { from, to } = {}) => {
  const conditions = [];
  const params = [];
  if (from) { conditions.push("snapshot_at >= ?"); params.push(from); }
  if (to) { conditions.push("snapshot_at <= ?"); params.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.all(`SELECT * FROM admin_platform_snapshots ${where} ORDER BY snapshot_at ASC`, ...params);
};

const recordRouteStats = async (db, { routeFamily, hourStart, responseTimeMs, isError }) => {
  await db.run(
    `INSERT INTO admin_route_hourly_stats (route_family, hour_start, call_count, error_count, total_response_time_ms, max_response_time_ms)
     VALUES (?, ?, 1, ?, ?, ?)
     ON CONFLICT(route_family, hour_start) DO UPDATE SET
       call_count = call_count + 1,
       error_count = error_count + excluded.error_count,
       total_response_time_ms = total_response_time_ms + excluded.total_response_time_ms,
       max_response_time_ms = MAX(max_response_time_ms, excluded.max_response_time_ms)`,
    routeFamily,
    hourStart,
    isError ? 1 : 0,
    responseTimeMs,
    responseTimeMs
  );
};

const listRouteStats = async (db, { from, to, routeFamily } = {}) => {
  const conditions = [];
  const params = [];
  if (from) { conditions.push("hour_start >= ?"); params.push(from); }
  if (to) { conditions.push("hour_start <= ?"); params.push(to); }
  if (routeFamily) { conditions.push("route_family = ?"); params.push(routeFamily); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.all(`SELECT * FROM admin_route_hourly_stats ${where} ORDER BY hour_start ASC`, ...params);
};

const listAggregatedRouteStats = async (db, { from, to, limit = 25, offset = 0 } = {}) => {
  const conditions = [];
  const params = [];
  if (from) { conditions.push("hour_start >= ?"); params.push(from); }
  if (to) { conditions.push("hour_start <= ?"); params.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await db.all(
    `SELECT route_family,
            SUM(call_count) AS call_count,
            SUM(error_count) AS error_count,
            SUM(total_response_time_ms) AS total_response_time_ms,
            MAX(max_response_time_ms) AS max_response_time_ms
     FROM admin_route_hourly_stats
     ${where}
     GROUP BY route_family
     HAVING SUM(call_count) > 0
     ORDER BY SUM(call_count) DESC
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  return rows;
};

const countAggregatedRouteStats = async (db, { from, to } = {}) => {
  const conditions = [];
  const params = [];
  if (from) { conditions.push("hour_start >= ?"); params.push(from); }
  if (to) { conditions.push("hour_start <= ?"); params.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const row = await db.get(
    `SELECT COUNT(DISTINCT route_family) AS count
     FROM admin_route_hourly_stats
     ${where}`,
    ...params
  );
  return row?.count ?? 0;
};

const insertBackupRun = async (db, run) => {
  await db.run(
    `INSERT INTO admin_backup_runs (id, started_at, completed_at, status, files_json, total_bytes, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    run.id,
    run.startedAt,
    run.completedAt ?? null,
    run.status,
    JSON.stringify(run.files ?? []),
    run.totalBytes ?? 0,
    run.errorMessage ?? null
  );
};

const listBackupRuns = async (db, { limit = 20 } = {}) => {
  const rows = await db.all(
    `SELECT * FROM admin_backup_runs ORDER BY started_at DESC LIMIT ?`,
    limit
  );
  return rows.map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    files: JSON.parse(row.files_json || "[]"),
    totalBytes: row.total_bytes,
    errorMessage: row.error_message,
  }));
};

const insertJobRun = async (db, run) => {
  await db.run(
    `INSERT INTO admin_job_runs (id, job_name, started_at, completed_at, status, duration_ms, rows_affected, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    run.id,
    run.jobName,
    run.startedAt,
    run.completedAt ?? null,
    run.status,
    run.durationMs ?? null,
    run.rowsAffected ?? 0,
    run.errorMessage ?? null
  );
};

const getLastJobRun = async (db, jobName) => {
  const row = await db.get(
    `SELECT * FROM admin_job_runs WHERE job_name = ? ORDER BY started_at DESC LIMIT 1`,
    jobName
  );
  if (!row) return null;
  return {
    id: row.id,
    jobName: row.job_name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    durationMs: row.duration_ms,
    rowsAffected: row.rows_affected,
    errorMessage: row.error_message,
  };
};

const listJobRuns = async (db, { jobName, limit = 50 } = {}) => {
  const conditions = [];
  const params = [];
  if (jobName) { conditions.push("job_name = ?"); params.push(jobName); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await db.all(
    `SELECT * FROM admin_job_runs ${where} ORDER BY started_at DESC LIMIT ?`,
    ...params,
    limit
  );
  return rows.map((row) => ({
    id: row.id,
    jobName: row.job_name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    durationMs: row.duration_ms,
    rowsAffected: row.rows_affected,
    errorMessage: row.error_message,
  }));
};

const getMaintenanceMode = async (db) => {
  const row = await db.get(`SELECT mode, updated_at AS updatedAt, updated_by AS updatedBy FROM admin_maintenance WHERE id = 1`);
  return row ?? { mode: "off", updatedAt: 0, updatedBy: null };
};

const setMaintenanceMode = async (db, { mode, updatedBy }) => {
  await db.run(
    `UPDATE admin_maintenance SET mode = ?, updated_at = ?, updated_by = ? WHERE id = 1`,
    mode,
    Date.now(),
    updatedBy ?? null
  );
};

export {
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
  mapEventRow,
};
