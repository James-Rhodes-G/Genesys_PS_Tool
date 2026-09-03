const DANGEROUS_ROUTES = {
  "POST /api/genesys/master-admin-role": { action: "master_admin_role", feature: "quick-actions" },
  "POST /api/genesys/conversations/bulk-disconnect": { action: "bulk_disconnect", feature: "bulk-actions" },
  "POST /api/genesys/conversations/bulk-priority": { action: "bulk_priority_update", feature: "bulk-actions" },
  "POST /api/genesys/phones/bulk-delete": { action: "bulk_phone_delete", feature: "bulk-actions" },
  "POST /api/genesys/phones/bulk-site-migrate": { action: "bulk_phone_site_migrate", feature: "bulk-actions" },
  "POST /api/genesys/users/bulk-password-reset": { action: "bulk_password_reset", feature: "bulk-actions" },
};

const ROUTE_ACTIONS = {
  "POST /api/launch/pair": { action: "launch_pair", feature: "launch" },
  "POST /api/launch/handoff": { action: "launch_handoff", feature: "launch" },
  "POST /api/launch/unpair": { action: "launch_unpair", feature: "launch" },
  "POST /api/launch/disconnect": { action: "launch_disconnect", feature: "launch" },
  "GET /launch": { action: "launch_consume", feature: "launch" },
  "POST /api/session/bind": { action: "session_bind", feature: "session" },
  "POST /api/session/clear": { action: "session_clear", feature: "session" },
  "POST /api/genesys/users/bulk-logoff": { action: "bulk_logoff", feature: "bulk-actions" },
  "POST /api/genesys/users/bulk-role-assign": { action: "bulk_role_assign", feature: "bulk-actions" },
  "POST /api/genesys/users/bulk-skill-assign": { action: "bulk_skill_assign", feature: "bulk-actions" },
  "POST /api/genesys/users/bulk-auto-answer": { action: "bulk_auto_answer", feature: "bulk-actions" },
  "POST /api/genesys/phones/bulk-build": { action: "bulk_phone_build", feature: "bulk-actions" },
  "POST /api/genesys/phones/bulk-move": { action: "bulk_phone_move", feature: "bulk-actions" },
  "POST /api/genesys/schedules/load": { action: "load_schedules", feature: "bulk-actions" },
  "POST /api/genesys/call-spoof": { action: "call_spoof", feature: "call-spoof" },
  "POST /api/genesys/call-spoof/inbound": { action: "call_spoof_inbound", feature: "call-spoof" },
  ...DANGEROUS_ROUTES,
};

const getRouteKey = (req) => `${req.method} ${req.path}`;

const getMockApiRouteAction = (req) => {
  const { method, path } = req;
  if (!path.startsWith("/api/mock-api/")) {
    return null;
  }
  if (method === "POST" && path === "/api/mock-api/endpoints") {
    return { action: "mock_api_create", feature: "mock-api" };
  }
  if (method === "PUT" && /^\/api\/mock-api\/endpoints\/[^/]+$/.test(path)) {
    return { action: "mock_api_update", feature: "mock-api" };
  }
  if (method === "DELETE" && /^\/api\/mock-api\/endpoints\/[^/]+$/.test(path)) {
    return { action: "mock_api_delete", feature: "mock-api" };
  }
  if (path.endsWith("/activate")) {
    return { action: "mock_api_activate", feature: "mock-api" };
  }
  if (path.endsWith("/archive")) {
    return { action: "mock_api_pause", feature: "mock-api" };
  }
  if (path.endsWith("/restore")) {
    return { action: "mock_api_restore", feature: "mock-api" };
  }
  if (path.endsWith("/clone")) {
    return { action: "mock_api_clone", feature: "mock-api" };
  }
  return null;
};

const getRouteAction = (req) => {
  const key = getRouteKey(req);
  if (ROUTE_ACTIONS[key]) return ROUTE_ACTIONS[key];
  const mockApiAction = getMockApiRouteAction(req);
  if (mockApiAction) return mockApiAction;
  if (req.method === "POST" && req.path.startsWith("/api/genesys/")) {
    const segment = req.path.replace("/api/genesys/", "").split("/")[0];
    return { action: `genesys_${segment}`, feature: "genesys" };
  }
  return null;
};

const isDangerousRoute = (req) => Boolean(DANGEROUS_ROUTES[getRouteKey(req)]);

const extractActor = (req) => ({
  sessionId: req.sessionId ?? null,
  orgId: req.genesysCredentials?.orgId || req.body?.orgId || null,
  userId: req.genesysCredentials?.userId || req.body?.userId || null,
  userName: req.genesysCredentials?.userDisplayName || req.genesysCredentials?.userName || null,
  region: req.genesysCredentials?.region || req.body?.region || null,
  ip: req.ip || req.socket?.remoteAddress || null,
  source: (typeof req.get === "function" && req.get("x-ps-tool-source") === "extension") ? "extension" : "web",
  requestId: req.requestId ?? null,
});

const createAuditService = ({ adminDb, insertAdminEvent, insertAdminActivity }) => {
  const recordEvent = async (req, { action, feature, status = "success", itemCount = 0, successCount = 0, failureCount = 0, errorCode = null, metaJson = {}, isDangerous = false, source, orgId, userId, userName }) => {
    const actor = extractActor(req);
    await insertAdminEvent(adminDb, {
      ...actor,
      orgId: orgId ?? actor.orgId,
      userId: userId ?? actor.userId,
      userName: userName ?? actor.userName,
      source: source ?? actor.source,
      action,
      feature,
      status,
      itemCount,
      successCount,
      failureCount,
      errorCode,
      metaJson,
      isDangerous,
    });
    if (req.sessionId && action) {
      await insertAdminActivity(adminDb, {
        sessionId: req.sessionId,
        orgId: actor.orgId,
        userId: actor.userId,
        action,
        affectedCount: itemCount,
        successCount,
        failureCount,
      });
    }
  };

  const createAuditMiddleware = () => (req, res, next) => {
    const routeAction = getRouteAction(req);
    if (!routeAction) return next();

    const start = Date.now();
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const status = res.statusCode >= 400 ? "failure" : "success";
      const itemCount = body?.results?.length ?? body?.count ?? body?.itemCount ?? 0;
      const successCount = body?.successCount ?? (status === "success" ? itemCount : 0);
      const failureCount = body?.failureCount ?? (status === "failure" ? 1 : 0);
      recordEvent(req, {
        action: routeAction.action,
        feature: routeAction.feature,
        status,
        itemCount,
        successCount,
        failureCount,
        errorCode: body?.error ? String(body.error).slice(0, 200) : null,
        isDangerous: isDangerousRoute(req),
        metaJson: { durationMs: Date.now() - start, statusCode: res.statusCode },
      }).catch(() => {});
      return originalJson(body);
    };
    next();
  };

  return { recordEvent, createAuditMiddleware, isDangerousRoute, DANGEROUS_ROUTES };
};

export { createAuditService, getRouteAction, isDangerousRoute, DANGEROUS_ROUTES, ROUTE_ACTIONS };
