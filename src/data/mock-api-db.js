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
      `);

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
      response_body, response_time_ms, request_ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

export {
  initMockApiDb,
  mockApiDbPath,
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
};
