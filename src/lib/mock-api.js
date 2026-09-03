import crypto from "crypto";
import { MOCK_API_CONFIG } from "./mock-api-config.js";

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "proxy-authorization",
]);

const HTTP_STATUS_PRESETS = [
  { code: 200, label: "200 OK" },
  { code: 201, label: "201 Created" },
  { code: 202, label: "202 Accepted" },
  { code: 204, label: "204 No Content" },
  { code: 301, label: "301 Moved Permanently" },
  { code: 302, label: "302 Found" },
  { code: 307, label: "307 Temporary Redirect" },
  { code: 400, label: "400 Bad Request" },
  { code: 401, label: "401 Unauthorized" },
  { code: 403, label: "403 Forbidden" },
  { code: 404, label: "404 Not Found" },
  { code: 405, label: "405 Method Not Allowed" },
  { code: 409, label: "409 Conflict" },
  { code: 415, label: "415 Unsupported Media Type" },
  { code: 422, label: "422 Unprocessable Entity" },
  { code: 429, label: "429 Too Many Requests" },
  { code: 500, label: "500 Internal Server Error" },
  { code: 501, label: "501 Not Implemented" },
  { code: 502, label: "502 Bad Gateway" },
  { code: 503, label: "503 Service Unavailable" },
  { code: 504, label: "504 Gateway Timeout" },
];

const normalizeEndpointSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9*-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const deriveUserpart = (user) => {
  const email = String(user?.email || "").trim().toLowerCase();
  if (email.includes("@")) {
    return email.split("@")[0].replace(/[^a-z0-9*-]+/g, "").slice(0, 64) || "user";
  }

  const username = String(user?.username || user?.name || "user")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9*-]+/g, "")
    .slice(0, 64);

  return username || "user";
};

const isValidHeaderName = (name) => /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name);

const redactHeaders = (headers = {}) => {
  const output = {};
  Object.entries(headers).forEach(([name, value]) => {
    if (SENSITIVE_HEADER_NAMES.has(String(name).toLowerCase())) {
      output[name] = "[REDACTED]";
      return;
    }
    output[name] = value;
  });
  return output;
};

const validateEndpointSlug = (slug) => {
  if (!slug) {
    throw new Error("Endpoint slug is required.");
  }

  if (slug.length > 64) {
    throw new Error("Endpoint slug must be 64 characters or fewer.");
  }

  if (!/^[a-z0-9*-]+$/.test(slug)) {
    throw new Error("Endpoint slug may only contain a-z, 0-9, and *.");
  }

  if (MOCK_API_CONFIG.reservedSlugs.has(slug)) {
    throw new Error(`"${slug}" is a reserved endpoint name.`);
  }
};

const validateHttpStatusCode = (statusCode) => {
  const code = Number(statusCode);
  if (!Number.isInteger(code) || code < 100 || code > 599) {
    throw new Error("HTTP status code must be between 100 and 599.");
  }
  return code;
};

const validateResponseBody = ({ contentType, body }) => {
  const normalizedBody = String(body ?? "");
  const bytes = Buffer.byteLength(normalizedBody, "utf8");
  if (bytes > MOCK_API_CONFIG.maxResponseBodyBytes) {
    throw new Error(`Response body exceeds ${MOCK_API_CONFIG.maxResponseBodyBytes} bytes.`);
  }

  if (contentType === "application/json" && normalizedBody.trim()) {
    try {
      JSON.parse(normalizedBody);
    } catch {
      throw new Error("Response body must be valid JSON for application/json.");
    }
  }

  return normalizedBody;
};

const validateResponseHeaders = (headers = {}) => {
  const entries = Object.entries(headers || {});
  if (entries.length > MOCK_API_CONFIG.maxHeaders) {
    throw new Error(`Response headers cannot exceed ${MOCK_API_CONFIG.maxHeaders}.`);
  }

  const normalized = {};
  entries.forEach(([name, value]) => {
    const trimmedName = String(name || "").trim();
    if (!isValidHeaderName(trimmedName)) {
      throw new Error(`Invalid response header name: ${name}`);
    }

    const stringValue = String(value ?? "");
    if (Buffer.byteLength(stringValue, "utf8") > MOCK_API_CONFIG.maxHeaderValueBytes) {
      throw new Error(`Header "${trimmedName}" exceeds the maximum value size.`);
    }

    normalized[trimmedName] = stringValue;
  });

  return normalized;
};

const validateDelayMs = (delayMs) => {
  const delay = Number(delayMs);
  if (!MOCK_API_CONFIG.allowedDelaysMs.includes(delay)) {
    throw new Error("Unsupported response delay.");
  }
  if (delay > MOCK_API_CONFIG.maxDelayMs) {
    throw new Error(`Delay cannot exceed ${MOCK_API_CONFIG.maxDelayMs} ms.`);
  }
  return delay;
};

const validateMethod = (method) => {
  const normalized = String(method || "GET").trim().toUpperCase();
  if (!MOCK_API_CONFIG.allowedMethods.has(normalized)) {
    throw new Error(`Unsupported HTTP method: ${method}`);
  }
  return normalized;
};

const validateContentType = (contentType) => {
  const normalized = String(contentType || "application/json").trim().toLowerCase();
  if (!MOCK_API_CONFIG.allowedContentTypes.has(normalized)) {
    throw new Error("Unsupported response content type.");
  }
  return normalized;
};

const buildPublicUrl = ({ req, userpart, endpointSlug }) => {
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost";
  const protocol = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${protocol}://${host}/mockAPI/${encodeURIComponent(userpart)}/${encodeURIComponent(endpointSlug)}`;
};

const computeExpiryTimestamp = ({ activatedAt, lastUsedAt, now = Date.now() }) => {
  const activityBase = lastUsedAt || activatedAt || now;
  const inactivityExpiry = activityBase + MOCK_API_CONFIG.inactivityMs;
  const lifetimeExpiry = (activatedAt || now) + MOCK_API_CONFIG.maxLifetimeMs;
  return Math.min(inactivityExpiry, lifetimeExpiry);
};

const createMockApiService = ({
  db,
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
}) => {
  const refreshLifecycle = async () => {
    const now = Date.now();
    await expireStaleActiveEndpoints(db, { now });

    const retentionCutoff = now - MOCK_API_CONFIG.retentionExpiredMs;
    await purgeDeletedEndpoints(db, { beforeTimestamp: retentionCutoff });
    await purgeArchivedEndpoints(db, { beforeTimestamp: retentionCutoff });
  };

  const buildOwnerContext = ({ user, sessionId, orgId, orgName }) => {
    const ownerEmail = String(user?.email || user?.username || "").trim().toLowerCase();
    const ownerUserpart = deriveUserpart(user);

    if (!ownerEmail) {
      throw new Error("Unable to resolve the current user email for mock endpoint ownership.");
    }

    return {
      ownerUserpart,
      ownerEmail,
      ownerSessionId: sessionId,
      ownerOrgId: orgId,
      ownerOrgName: orgName || "",
    };
  };

  const normalizeEndpointInput = (input = {}) => {
    const endpointSlug = normalizeEndpointSlug(input.endpointSlug || input.name);
    validateEndpointSlug(endpointSlug);

    const responseContentType = validateContentType(input.responseContentType);

    return {
      endpointSlug,
      method: validateMethod(input.method),
      httpStatusCode: validateHttpStatusCode(input.httpStatusCode ?? 200),
      responseContentType,
      responseBody: validateResponseBody({
        contentType: responseContentType,
        body: input.responseBody ?? "",
      }),
      responseHeaders: validateResponseHeaders(input.responseHeaders || {}),
      delayMs: validateDelayMs(input.delayMs ?? 0),
      status: input.status || "draft",
    };
  };

  const createEndpoint = async ({ owner, input, activate = false }) => {
    await refreshLifecycle();

    const count = await countActiveEndpoints(db, {
      ownerUserpart: owner.ownerUserpart,
    });
    if (count >= MOCK_API_CONFIG.maxEndpointsPerUser) {
      throw new Error(`You can have at most ${MOCK_API_CONFIG.maxEndpointsPerUser} mock endpoints.`);
    }

    const normalized = normalizeEndpointInput(input);
    const now = Date.now();
    const endpoint = {
      id: crypto.randomUUID(),
      ...owner,
      ...normalized,
      status: activate ? "active" : normalized.status === "active" ? "active" : "draft",
      createdAt: now,
      updatedAt: now,
      activatedAt: activate || normalized.status === "active" ? now : null,
      lastUsedAt: null,
      expiresAt:
        activate || normalized.status === "active"
          ? computeExpiryTimestamp({ activatedAt: now, lastUsedAt: null, now })
          : null,
      hitCount: 0,
    };

    try {
      await insertEndpoint(db, endpoint);
    } catch (error) {
      if (String(error?.message || "").includes("UNIQUE")) {
        throw new Error("An endpoint with this method and slug already exists.");
      }
      throw error;
    }
    return endpoint;
  };

  const updateEndpointForOwner = async ({ owner, id, input }) => {
    await refreshLifecycle();
    const existing = await getEndpointById(db, {
      id,
      ownerUserpart: owner.ownerUserpart,
    });

    if (!existing) {
      throw new Error("Mock endpoint not found.");
    }

    if (["deleted", "archived"].includes(existing.status)) {
      throw new Error("Archived or deleted endpoints must be restored before editing.");
    }

    const normalized = normalizeEndpointInput({ ...existing, ...input, status: existing.status });
    const updated = {
      ...existing,
      ...normalized,
      updatedAt: Date.now(),
    };

    if (updated.status === "active") {
      updated.expiresAt = computeExpiryTimestamp({
        activatedAt: updated.activatedAt || updated.updatedAt,
        lastUsedAt: updated.lastUsedAt,
        now: updated.updatedAt,
      });
    }

    await updateEndpoint(db, updated);
    return updated;
  };

  const activateEndpoint = async ({ owner, id }) => {
    const existing = await getEndpointById(db, {
      id,
      ownerUserpart: owner.ownerUserpart,
    });
    if (!existing) {
      throw new Error("Mock endpoint not found.");
    }

    const now = Date.now();
    const updated = {
      ...existing,
      status: "active",
      activatedAt: now,
      updatedAt: now,
      expiresAt: computeExpiryTimestamp({ activatedAt: now, lastUsedAt: existing.lastUsedAt, now }),
    };
    await updateEndpoint(db, updated);
    return updated;
  };

  const archiveEndpoint = async ({ owner, id }) => {
    await markEndpointStatus(db, {
      id,
      ownerUserpart: owner.ownerUserpart,
      status: "archived",
      updatedAt: Date.now(),
    });
  };

  const restoreEndpoint = async ({ owner, id }) => {
    const existing = await getEndpointById(db, {
      id,
      ownerUserpart: owner.ownerUserpart,
    });
    if (!existing) {
      throw new Error("Mock endpoint not found.");
    }

    const now = Date.now();
    const updated = {
      ...existing,
      status: "active",
      activatedAt: now,
      updatedAt: now,
      expiresAt: computeExpiryTimestamp({ activatedAt: now, lastUsedAt: null, now }),
      lastUsedAt: null,
    };
    await updateEndpoint(db, updated);
    return updated;
  };

  const deleteEndpoint = async ({ owner, id }) => {
    await markEndpointStatus(db, {
      id,
      ownerUserpart: owner.ownerUserpart,
      status: "deleted",
      updatedAt: Date.now(),
    });
  };

  const cloneEndpoint = async ({ owner, id }) => {
    const existing = await getEndpointById(db, {
      id,
      ownerUserpart: owner.ownerUserpart,
    });
    if (!existing) {
      throw new Error("Mock endpoint not found.");
    }

    const cloneSuffix = "-copy";
    let slug = normalizeEndpointSlug(`${existing.endpointSlug}${cloneSuffix}`);
    if (slug.length > 64) {
      slug = slug.slice(0, 64 - cloneSuffix.length) + cloneSuffix;
    }

    return createEndpoint({
      owner,
      input: {
        endpointSlug: slug,
        method: existing.method,
        httpStatusCode: existing.httpStatusCode,
        responseContentType: existing.responseContentType,
        responseBody: existing.responseBody,
        responseHeaders: existing.responseHeaders,
        delayMs: existing.delayMs,
        status: "draft",
      },
      activate: false,
    });
  };

  const listOwnedEndpoints = async ({ owner, group = "active" }) => {
    await refreshLifecycle();
    const statusMap = {
      active: ["draft", "active"],
      expired: ["expired"],
      archived: ["archived"],
    };
    const statuses = statusMap[group] || statusMap.active;
    const endpoints = await listEndpoints(db, {
      ownerUserpart: owner.ownerUserpart,
      statuses,
    });

    return endpoints.map((endpoint) => ({
      ...endpoint,
      publicUrl: `/mockAPI/${endpoint.ownerUserpart}/${endpoint.endpointSlug}`,
    }));
  };

  const getOwnedEndpoint = async ({ owner, id }) => {
    await refreshLifecycle();
    const endpoint = await getEndpointById(db, {
      id,
      ownerUserpart: owner.ownerUserpart,
    });
    if (!endpoint) {
      throw new Error("Mock endpoint not found.");
    }
    return {
      ...endpoint,
      publicUrl: `/mockAPI/${endpoint.ownerUserpart}/${endpoint.endpointSlug}`,
    };
  };

  const invokeEndpoint = async ({ req, res, userpart, endpointSlug }) => {
    await refreshLifecycle();
    const method = validateMethod(req.method);
    const endpoint = await getEndpointForInvocation(db, {
      userpart: String(userpart || "").toLowerCase(),
      endpointSlug: normalizeEndpointSlug(endpointSlug),
      method,
    });

    if (!endpoint) {
      res.status(404).json({ error: "Mock endpoint not found." });
      return;
    }

    const startedAt = Date.now();
    const requestBody =
      req.body instanceof Buffer
        ? req.body.toString("utf8")
        : typeof req.body === "string"
          ? req.body
          : req.body && typeof req.body === "object"
            ? JSON.stringify(req.body)
            : "";

    if (Buffer.byteLength(requestBody, "utf8") > MOCK_API_CONFIG.maxRequestBodyBytes) {
      res.status(413).json({ error: "Request body too large." });
      return;
    }

    if (endpoint.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, endpoint.delayMs));
    }

    const responseHeaders = {
      ...endpoint.responseHeaders,
      "Content-Type": endpoint.responseContentType,
      "X-Mock-Endpoint-Id": endpoint.id,
    };

    Object.entries(responseHeaders).forEach(([name, value]) => {
      res.setHeader(name, value);
    });

    const responseBody = endpoint.responseBody || "";
    res.status(endpoint.httpStatusCode);

    if (endpoint.httpStatusCode === 204 || method === "HEAD") {
      res.end();
    } else if (endpoint.responseContentType === "application/json") {
      res.send(responseBody);
    } else {
      res.type(endpoint.responseContentType).send(responseBody);
    }

    const finishedAt = Date.now();
    const now = finishedAt;
    const nextHitCount = endpoint.hitCount + 1;
    const nextExpiresAt = computeExpiryTimestamp({
      activatedAt: endpoint.activatedAt || now,
      lastUsedAt: now,
      now,
    });

    await recordEndpointUsage(db, {
      id: endpoint.id,
      lastUsedAt: now,
      expiresAt: nextExpiresAt,
      hitCount: nextHitCount,
    });

    const logEntry = {
      id: crypto.randomUUID(),
      endpointId: endpoint.id,
      timestamp: now,
      method,
      path: req.originalUrl.split("?")[0],
      queryString: req.originalUrl.includes("?") ? req.originalUrl.split("?").slice(1).join("?") : "",
      requestHeaders: redactHeaders(req.headers),
      requestBody,
      responseCode: endpoint.httpStatusCode,
      responseHeaders,
      responseBody,
      responseTimeMs: finishedAt - startedAt,
      requestIp: req.ip || req.socket?.remoteAddress || "",
      requestBodyBytes: Buffer.byteLength(requestBody, "utf8"),
      responseBodyBytes: Buffer.byteLength(responseBody, "utf8"),
    };

    await insertRequestLog(db, logEntry);
    if (recordHourlyStats) {
      const hourStart = Math.floor(now / 3600000) * 3600000;
      await recordHourlyStats(db, {
        endpointId: endpoint.id,
        hourStart,
        requestBytes: logEntry.requestBodyBytes,
        responseBytes: logEntry.responseBodyBytes,
        responseTimeMs: logEntry.responseTimeMs,
        isError: endpoint.httpStatusCode >= 400,
        requestIp: logEntry.requestIp,
      });
    }
    await trimRequestLogs(db, {
      endpointId: endpoint.id,
      maxLogs: MOCK_API_CONFIG.maxRequestLogsPerEndpoint,
    });
  };

  const listEndpointLogs = async ({ owner, endpointId, limit = 100, offset = 0 }) => {
    await getOwnedEndpoint({ owner, id: endpointId });
    return listRequestLogs(db, {
      endpointId,
      ownerUserpart: owner.ownerUserpart,
      limit,
      offset,
    });
  };

  const getEndpointLog = async ({ owner, logId }) => {
    const log = await getRequestLogById(db, {
      logId,
      ownerUserpart: owner.ownerUserpart,
    });
    if (!log) {
      throw new Error("Request log not found.");
    }
    return log;
  };

  return {
    HTTP_STATUS_PRESETS,
    MOCK_API_CONFIG,
    buildOwnerContext,
    buildPublicUrl,
    normalizeEndpointSlug,
    createEndpoint,
    updateEndpointForOwner,
    activateEndpoint,
    archiveEndpoint,
    restoreEndpoint,
    deleteEndpoint,
    cloneEndpoint,
    listOwnedEndpoints,
    getOwnedEndpoint,
    invokeEndpoint,
    listEndpointLogs,
    getEndpointLog,
    refreshLifecycle,
  };
};

export {
  HTTP_STATUS_PRESETS,
  MOCK_API_CONFIG,
  createMockApiService,
  deriveUserpart,
  normalizeEndpointSlug,
  redactHeaders,
};
