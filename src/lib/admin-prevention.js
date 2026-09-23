import { createRateLimiter } from "./launch-validation.js";

const DANGEROUS_ROUTE_PATTERNS = [
  "/api/genesys/master-admin-role",
  "/api/genesys/conversations/bulk-disconnect",
  "/api/genesys/conversations/bulk-priority",
  "/api/genesys/phones/bulk-delete",
  "/api/genesys/phones/bulk-site-migrate",
  "/api/genesys/users/bulk-password-reset",
];

const genesysMutationLimiter = createRateLimiter({
  limit: Number(process.env.GENESYS_MUTATION_RATE_LIMIT || 120),
  windowMs: 60 * 1000,
  keyFn: (req) => `${req.ip}:${req.sessionId || "anon"}`,
});

const bulkActionLimiter = createRateLimiter({
  limit: Number(process.env.BULK_ACTION_RATE_LIMIT || 30),
  windowMs: 60 * 60 * 1000,
  keyFn: (req) => `${req.sessionId || req.ip}:bulk`,
});

// Progress-driven bulk routes send one item per request; Genesys pacing is handled server-side.
const INCREMENTAL_BULK_ROUTES = new Set([
  "/api/genesys/phones/bulk-move",
  "/api/genesys/phones/bulk-delete",
  "/api/genesys/phones/bulk-build",
]);

const isBulkRoute = (path) =>
  path.includes("/bulk-") ||
  path.includes("/master-admin") ||
  path.includes("/schedules/load");

const isIncrementalBulkRoute = (path) => INCREMENTAL_BULK_ROUTES.has(path);

const createPreventionMiddleware = ({ sessionDb, getSessionConnection }) => {
  const validateOrgBind = async (req, res, next) => {
    if (!req.sessionId || !req.genesysCredentials?.orgId) {
      return next();
    }
    try {
      const connection = await getSessionConnection(sessionDb, req.sessionId);
      if (connection && connection.orgId && connection.orgId !== req.genesysCredentials.orgId) {
        return res.status(403).json({ error: "Session org does not match credentials." });
      }
    } catch (_error) {
      // continue
    }
    next();
  };

  const rateLimitGenesysMutations = (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      return next();
    }
    if (!req.path.startsWith("/api/genesys/")) {
      return next();
    }
    if (isIncrementalBulkRoute(req.path)) {
      return next();
    }
    return genesysMutationLimiter(req, res, () => {
      if (isBulkRoute(req.path)) {
        return bulkActionLimiter(req, res, next);
      }
      return next();
    });
  };

  const blockDangerousInMaintenance = async (req, res, next) => {
    const mode = process.env.MAINTENANCE_MODE || "off";
    if (mode !== "read_only") return next();
    if (DANGEROUS_ROUTE_PATTERNS.some((p) => req.path === p)) {
      return res.status(503).json({ error: "Dangerous actions blocked during maintenance." });
    }
    next();
  };

  const enforceAuthorizedOrgs = (req, res, next) => {
    const allowlist = process.env.GENESYS_AUTHORIZED_ORGS;
    if (!allowlist) return next();
    const allowed = new Set(allowlist.split(",").map((s) => s.trim()).filter(Boolean));
    const orgId = req.genesysCredentials?.orgId || req.body?.orgId;
    if (orgId && !allowed.has(orgId)) {
      return res.status(403).json({ error: "Organization not authorized on this instance." });
    }
    next();
  };

  return {
    validateOrgBind,
    rateLimitGenesysMutations,
    blockDangerousInMaintenance,
    enforceAuthorizedOrgs,
  };
};

export { createPreventionMiddleware, DANGEROUS_ROUTE_PATTERNS, INCREMENTAL_BULK_ROUTES };
