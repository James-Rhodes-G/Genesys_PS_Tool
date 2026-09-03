const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeSegment = (segment) => {
  if (!segment) return segment;
  if (UUID_RE.test(segment)) return ":id";
  if (/^[0-9a-f-]{24,}$/i.test(segment)) return ":id";
  return segment;
};

const classifyRouteFamily = (method, path) => {
  if (path.startsWith("/api/launch/")) {
    return `${method} /api/launch/${path.split("/").pop()}`;
  }
  if (path === "/launch") {
    return "GET /launch";
  }
  if (path.startsWith("/api/session/")) {
    return `${method} ${path}`;
  }
  if (!path.startsWith("/api/genesys/")) {
    return null;
  }
  const parts = path
    .replace("/api/genesys/", "")
    .split("/")
    .map(normalizeSegment);
  return `${method} /api/genesys/${parts.join("/")}`;
};

const hourStart = (timestamp = Date.now()) => Math.floor(timestamp / 3600000) * 3600000;

const createCoreApiMetricsMiddleware = ({ recordRouteStats, adminDb }) => {
  return (req, res, next) => {
    const routeFamily = classifyRouteFamily(req.method, req.path);
    if (!routeFamily) return next();

    const start = Date.now();
    res.on("finish", () => {
      const responseTimeMs = Date.now() - start;
      const isError = res.statusCode >= 400;
      recordRouteStats(adminDb, {
        routeFamily,
        hourStart: hourStart(),
        responseTimeMs,
        isError,
      }).catch(() => {});
    });
    next();
  };
};

export { createCoreApiMetricsMiddleware, classifyRouteFamily, hourStart };
