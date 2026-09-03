import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mockApiDbPath = path.resolve(__dirname, "../../data/mock-api.db");

let mockApiDbPromise;

const mapEndpointRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    ownerUserpart: row.owner_userpart,
    ownerEmail: row.owner_email,
    ownerSessionId: row.owner_session_id,
    ownerOrgId: row.owner_org_id,
    ownerOrgName: row.owner_org_name,
    endpointSlug: row.endpoint_slug,
    method: row.method,
    status: row.status,
    httpStatusCode: row.http_status_code,
    responseContentType: row.response_content_type,
    responseBody: row.response_body,
    responseHeaders: JSON.parse(row.response_headers_json || "{}"),
    delayMs: row.delay_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activatedAt: row.activated_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    hitCount: row.hit_count,
  };
};

const mapLogRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    endpointId: row.endpoint_id,
    timestamp: row.timestamp,
    method: row.method,
    path: row.path,
    queryString: row.query_string,
    requestHeaders: JSON.parse(row.request_headers_json || "{}"),
    requestBody: row.request_body,
    responseCode: row.response_code,
    responseHeaders: JSON.parse(row.response_headers_json || "{}"),
    responseBody: row.response_body,
    responseTimeMs: row.response_time_ms,
    requestIp: row.request_ip,
    requestBodyBytes: row.request_body_bytes,
    responseBodyBytes: row.response_body_bytes,
  };
};

const initMockApiDb = async () => {
  if (!mockApiDbPromise) {
    mockApiDbPromise = open({
      filename: mockApiDbPath,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS mock_endpoints (
          id TEXT PRIMARY KEY,
          owner_userpart TEXT NOT NULL,
          owner_email TEXT NOT NULL,
          owner_session_id TEXT NOT NULL,
          owner_org_id TEXT NOT NULL,
          owner_org_name TEXT,
          endpoint_slug TEXT NOT NULL,
          method TEXT NOT NULL,
          status TEXT NOT NULL,
          http_status_code INTEGER NOT NULL DEFAULT 200,
          response_content_type TEXT NOT NULL DEFAULT 'application/json',
          response_body TEXT NOT NULL DEFAULT '',
          response_headers_json TEXT NOT NULL DEFAULT '{}',
          delay_ms INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          activated_at INTEGER,
          last_used_at INTEGER,
          expires_at INTEGER,
          hit_count INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_mock_endpoints_owner
          ON mock_endpoints(owner_userpart, status);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_mock_endpoints_unique_slug
          ON mock_endpoints(owner_userpart, method, endpoint_slug)
          WHERE status NOT IN ('deleted');

        CREATE TABLE IF NOT EXISTS mock_request_logs (
          id TEXT PRIMARY KEY,
          endpoint_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          method TEXT NOT NULL,
          path TEXT NOT NULL,
          query_string TEXT,
          request_headers_json TEXT NOT NULL DEFAULT '{}',
          request_body TEXT,
          response_code INTEGER NOT NULL,
          response_headers_json TEXT NOT NULL DEFAULT '{}',
          response_body TEXT,
          response_time_ms INTEGER NOT NULL,
          request_ip TEXT,
          FOREIGN KEY(endpoint_id) REFERENCES mock_endpoints(id)
        );

        CREATE INDEX IF NOT EXISTS idx_mock_request_logs_endpoint
          ON mock_request_logs(endpoint_id, timestamp DESC);

        CREATE TABLE IF NOT EXISTS mock_endpoint_hourly_stats (
          endpoint_id TEXT NOT NULL,
          hour_start INTEGER NOT NULL,
          call_count INTEGER NOT NULL DEFAULT 0,
          request_bytes INTEGER NOT NULL DEFAULT 0,
          response_bytes INTEGER NOT NULL DEFAULT 0,
          error_count INTEGER NOT NULL DEFAULT 0,
          unique_ip_count INTEGER NOT NULL DEFAULT 0,
          avg_response_time_ms INTEGER NOT NULL DEFAULT 0,
          max_response_time_ms INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (endpoint_id, hour_start)
        );
      `);

      try {
        await db.exec(`ALTER TABLE mock_request_logs ADD COLUMN request_body_bytes INTEGER`);
      } catch (_error) {}
      try {
        await db.exec(`ALTER TABLE mock_request_logs ADD COLUMN response_body_bytes INTEGER`);
      } catch (_error) {}

      return db;
    });
  }

  return mockApiDbPromise;
};

const insertEndpoint = async (db, endpoint) => {
  await db.run(
    `INSERT INTO mock_endpoints (
      id, owner_userpart, owner_email, owner_session_id, owner_org_id, owner_org_name,
      endpoint_slug, method, status, http_status_code, response_content_type, response_body,
      response_headers_json, delay_ms, created_at, updated_at, activated_at, last_used_at, expires_at, hit_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      endpoint.id,
      endpoint.ownerUserpart,
      endpoint.ownerEmail,
      endpoint.ownerSessionId,
      endpoint.ownerOrgId,
      endpoint.ownerOrgName,
      endpoint.endpointSlug,
      endpoint.method,
      endpoint.status,
      endpoint.httpStatusCode,
      endpoint.responseContentType,
      endpoint.responseBody,
      JSON.stringify(endpoint.responseHeaders || {}),
      endpoint.delayMs,
      endpoint.createdAt,
      endpoint.updatedAt,
      endpoint.activatedAt,
      endpoint.lastUsedAt,
      endpoint.expiresAt,
      endpoint.hitCount || 0,
    ]
  );

  return endpoint;
};

const updateEndpoint = async (db, endpoint) => {
  await db.run(
    `UPDATE mock_endpoints SET
      endpoint_slug = ?,
      method = ?,
      status = ?,
      http_status_code = ?,
      response_content_type = ?,
      response_body = ?,
      response_headers_json = ?,
      delay_ms = ?,
      updated_at = ?,
      activated_at = ?,
      last_used_at = ?,
      expires_at = ?,
      hit_count = ?
    WHERE id = ? AND owner_userpart = ?`,
    [
      endpoint.endpointSlug,
      endpoint.method,
      endpoint.status,
      endpoint.httpStatusCode,
      endpoint.responseContentType,
      endpoint.responseBody,
      JSON.stringify(endpoint.responseHeaders || {}),
      endpoint.delayMs,
      endpoint.updatedAt,
      endpoint.activatedAt,
      endpoint.lastUsedAt,
      endpoint.expiresAt,
      endpoint.hitCount,
      endpoint.id,
      endpoint.ownerUserpart,
    ]
  );

  return endpoint;
};

const getEndpointById = async (db, { id, ownerUserpart }) => {
  const row = await db.get(
    `SELECT * FROM mock_endpoints
     WHERE id = ? AND owner_userpart = ? AND status != 'deleted'`,
    [id, ownerUserpart]
  );
  return mapEndpointRow(row);
};

const getEndpointForInvocation = async (db, { userpart, endpointSlug, method }) => {
  const row = await db.get(
    `SELECT * FROM mock_endpoints
     WHERE owner_userpart = ? AND endpoint_slug = ? AND method = ? AND status = 'active'`,
    [userpart, endpointSlug, method]
  );
  return mapEndpointRow(row);
};

const listEndpoints = async (db, { ownerUserpart, statuses = [] }) => {
  const placeholders = statuses.map(() => "?").join(", ");
  const rows = await db.all(
    `SELECT * FROM mock_endpoints
     WHERE owner_userpart = ? AND status IN (${placeholders})
     ORDER BY updated_at DESC`,
    [ownerUserpart, ...statuses]
  );
  return rows.map(mapEndpointRow);
};

const countActiveEndpoints = async (db, { ownerUserpart }) => {
  const row = await db.get(
    `SELECT COUNT(*) AS count FROM mock_endpoints
     WHERE owner_userpart = ?
       AND status IN ('draft', 'active', 'expired')`,
    [ownerUserpart]
  );
  return row?.count || 0;
};

const markEndpointStatus = async (db, { id, ownerUserpart, status, updatedAt }) => {
  await db.run(
    `UPDATE mock_endpoints SET status = ?, updated_at = ?
     WHERE id = ? AND owner_userpart = ?`,
    [status, updatedAt, id, ownerUserpart]
  );
};

const recordEndpointUsage = async (db, { id, lastUsedAt, expiresAt, hitCount }) => {
  await db.run(
    `UPDATE mock_endpoints SET last_used_at = ?, expires_at = ?, hit_count = ?, updated_at = ?
     WHERE id = ?`,
    [lastUsedAt, expiresAt, hitCount, lastUsedAt, id]
  );
};

const insertRequestLog = async (db, log) => {
  await db.run(
    `INSERT INTO mock_request_logs (
      id, endpoint_id, timestamp, method, path, query_string,
      request_headers_json, request_body, response_code, response_headers_json,
      response_body, response_time_ms, request_ip, request_body_bytes, response_body_bytes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.endpointId,
      log.timestamp,
      log.method,
      log.path,
      log.queryString,
      JSON.stringify(log.requestHeaders || {}),
      log.requestBody,
      log.responseCode,
      JSON.stringify(log.responseHeaders || {}),
      log.responseBody,
      log.responseTimeMs,
      log.requestIp,
      log.requestBodyBytes ?? 0,
      log.responseBodyBytes ?? 0,
    ]
  );
};

const trimRequestLogs = async (db, { endpointId, maxLogs }) => {
  await db.run(
    `DELETE FROM mock_request_logs
     WHERE endpoint_id = ?
       AND id NOT IN (
         SELECT id FROM mock_request_logs
         WHERE endpoint_id = ?
         ORDER BY timestamp DESC
         LIMIT ?
       )`,
    [endpointId, endpointId, maxLogs]
  );
};

const listRequestLogs = async (db, { endpointId, ownerUserpart, limit = 100, offset = 0 }) => {
  const rows = await db.all(
    `SELECT l.* FROM mock_request_logs l
     INNER JOIN mock_endpoints e ON e.id = l.endpoint_id
     WHERE l.endpoint_id = ? AND e.owner_userpart = ?
     ORDER BY l.timestamp DESC
     LIMIT ? OFFSET ?`,
    [endpointId, ownerUserpart, limit, offset]
  );
  return rows.map(mapLogRow);
};

const getRequestLogById = async (db, { logId, ownerUserpart }) => {
  const row = await db.get(
    `SELECT l.* FROM mock_request_logs l
     INNER JOIN mock_endpoints e ON e.id = l.endpoint_id
     WHERE l.id = ? AND e.owner_userpart = ?`,
    [logId, ownerUserpart]
  );
  return mapLogRow(row);
};

const purgeDeletedEndpoints = async (db, { beforeTimestamp }) => {
  const result = await db.run(
    `DELETE FROM mock_endpoints WHERE status = 'deleted' AND updated_at < ?`,
    [beforeTimestamp]
  );
  return result.changes || 0;
};

const purgeArchivedEndpoints = async (db, { beforeTimestamp }) => {
  const result = await db.run(
    `DELETE FROM mock_endpoints WHERE status = 'archived' AND updated_at < ?`,
    [beforeTimestamp]
  );
  return result.changes || 0;
};

const expireStaleActiveEndpoints = async (db, { now }) => {
  const result = await db.run(
    `UPDATE mock_endpoints SET status = 'expired', updated_at = ?
     WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= ?`,
    [now, now]
  );
  return result.changes || 0;
};

const listAllEndpoints = async (db, { limit = 200, offset = 0 } = {}) => {
  const rows = await db.all(
    `SELECT * FROM mock_endpoints WHERE status != 'deleted' ORDER BY hit_count DESC LIMIT ? OFFSET ?`,
    limit,
    offset
  );
  return rows.map(mapEndpointRow);
};

const getEndpointByIdAdmin = async (db, id) => {
  const row = await db.get(`SELECT * FROM mock_endpoints WHERE id = ?`, id);
  return mapEndpointRow(row);
};

const markEndpointStatusAdmin = async (db, { id, status, updatedAt }) => {
  await db.run(`UPDATE mock_endpoints SET status = ?, updated_at = ? WHERE id = ?`, status, updatedAt, id);
};

const recordHourlyStats = async (db, { endpointId, hourStart, requestBytes, responseBytes, responseTimeMs, isError, requestIp }) => {
  await db.run(
    `INSERT INTO mock_endpoint_hourly_stats
     (endpoint_id, hour_start, call_count, request_bytes, response_bytes, error_count, unique_ip_count, avg_response_time_ms, max_response_time_ms)
     VALUES (?, ?, 1, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(endpoint_id, hour_start) DO UPDATE SET
       call_count = call_count + 1,
       request_bytes = request_bytes + excluded.request_bytes,
       response_bytes = response_bytes + excluded.response_bytes,
       error_count = error_count + excluded.error_count,
       avg_response_time_ms = (avg_response_time_ms * call_count + excluded.avg_response_time_ms) / (call_count + 1),
       max_response_time_ms = MAX(max_response_time_ms, excluded.max_response_time_ms)`,
    endpointId,
    hourStart,
    requestBytes,
    responseBytes,
    isError ? 1 : 0,
    responseTimeMs,
    responseTimeMs
  );
};

const getEndpointStats24h = async (db, endpointId) => {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const row = await db.get(
    `SELECT COALESCE(SUM(call_count), 0) AS calls,
            COALESCE(SUM(request_bytes), 0) AS requestBytes,
            COALESCE(SUM(response_bytes), 0) AS responseBytes,
            COALESCE(SUM(error_count), 0) AS errors
     FROM mock_endpoint_hourly_stats
     WHERE endpoint_id = ? AND hour_start >= ?`,
    endpointId,
    since
  );
  const ipRow = await db.get(
    `SELECT COUNT(DISTINCT request_ip) AS uniqueIps
     FROM mock_request_logs
     WHERE endpoint_id = ? AND timestamp >= ?`,
    endpointId,
    since
  );
  return {
    calls24h: row?.calls ?? 0,
    requestBytes24h: row?.requestBytes ?? 0,
    responseBytes24h: row?.responseBytes ?? 0,
    errors24h: row?.errors ?? 0,
    uniqueIps24h: ipRow?.uniqueIps ?? 0,
  };
};

const getGlobalMockApiTraffic = async (db, { from, to } = {}) => {
  const fromTs = from ?? Date.now() - 24 * 60 * 60 * 1000;
  const toTs = to ?? Date.now();
  const row = await db.get(
    `SELECT COALESCE(SUM(call_count), 0) AS calls,
            COALESCE(SUM(request_bytes), 0) AS requestBytes,
            COALESCE(SUM(response_bytes), 0) AS responseBytes,
            COALESCE(SUM(error_count), 0) AS errors
     FROM mock_endpoint_hourly_stats
     WHERE hour_start >= ? AND hour_start <= ?`,
    fromTs,
    toTs
  );
  return row ?? { calls: 0, requestBytes: 0, responseBytes: 0, errors: 0 };
};

const listHourlyTraffic = async (db, { from, to } = {}) => {
  const fromTs = from ?? Date.now() - 24 * 60 * 60 * 1000;
  const toTs = to ?? Date.now();
  return db.all(
    `SELECT hour_start AS hourStart,
            SUM(call_count) AS calls,
            SUM(request_bytes) AS requestBytes,
            SUM(response_bytes) AS responseBytes,
            SUM(error_count) AS errors
     FROM mock_endpoint_hourly_stats
     WHERE hour_start >= ? AND hour_start <= ?
     GROUP BY hour_start
     ORDER BY hour_start ASC`,
    fromTs,
    toTs
  );
};

const listRequestLogsAdmin = async (db, { endpointId, limit = 100, offset = 0 }) => {
  const rows = await db.all(
    `SELECT * FROM mock_request_logs WHERE endpoint_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    endpointId,
    limit,
    offset
  );
  return rows.map(mapLogRow);
};

export {
  initMockApiDb,
  mockApiDbPath,
  insertEndpoint,
  updateEndpoint,
  getEndpointById,
  getEndpointByIdAdmin,
  getEndpointForInvocation,
  listEndpoints,
  listAllEndpoints,
  countActiveEndpoints,
  markEndpointStatus,
  markEndpointStatusAdmin,
  recordEndpointUsage,
  insertRequestLog,
  trimRequestLogs,
  listRequestLogs,
  listRequestLogsAdmin,
  getRequestLogById,
  purgeDeletedEndpoints,
  purgeArchivedEndpoints,
  expireStaleActiveEndpoints,
  recordHourlyStats,
  getEndpointStats24h,
  getGlobalMockApiTraffic,
  listHourlyTraffic,
};
