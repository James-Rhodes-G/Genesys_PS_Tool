let cachedMode = process.env.MAINTENANCE_MODE || "off";
let getModeFromDb = null;

const setModeProvider = (provider) => {
  getModeFromDb = provider;
};

const getMaintenanceMode = async () => {
  if (getModeFromDb) {
    try {
      const row = await getModeFromDb();
      cachedMode = row?.mode || cachedMode;
    } catch (_error) {
      // fall through to cached
    }
  }
  return cachedMode;
};

const isMaintenanceBlocking = async (path, method) => {
  const mode = await getMaintenanceMode();
  if (mode === "off") return false;
  if (mode === "read_only") {
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") return true;
    if (path.startsWith("/api/launch/pair") || path.startsWith("/api/launch/handoff")) return true;
    if (path.startsWith("/api/genesys/oauth")) return true;
    return false;
  }
  if (mode === "drain") {
    if (path.startsWith("/api/launch/pair") || path.startsWith("/api/launch/handoff")) return true;
    if (path.startsWith("/api/genesys/oauth")) return true;
    return false;
  }
  return false;
};

const createMaintenanceMiddleware = () => async (req, res, next) => {
  if (req.path === "/health" || req.path === "/ready") {
    return next();
  }
  const blocked = await isMaintenanceBlocking(req.path, req.method);
  if (blocked) {
    res.setHeader("Retry-After", "300");
    return res.status(503).json({ error: "Service is in maintenance mode.", mode: await getMaintenanceMode() });
  }
  next();
};

export { setModeProvider, getMaintenanceMode, isMaintenanceBlocking, createMaintenanceMiddleware };
