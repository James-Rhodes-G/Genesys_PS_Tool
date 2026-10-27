import { isSecureRequest } from "../lib/session-cookie.js";

const CSP_REPORT_ONLY = String(process.env.CSP_REPORT_ONLY ?? "1") !== "0";

const buildContentSecurityPolicy = () => {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'unsafe-inline' https://apps.usw2.pure.cloud https://apps.mypurecloud.com https://apps.mypurecloud.de https://apps.mypurecloud.ie https://apps.mypurecloud.jp https://apps.aps1.pure.cloud https://apps.apne2.pure.cloud https://apps.mypurecloud.com.au https://apps.mypurecloud.ca https://apps.use2.us-gov-pure.cloud",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "worker-src 'self'",
    "manifest-src 'self'",
  ];
  return directives.join("; ");
};

const createSecurityHeadersMiddleware = () => (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (isSecureRequest(req)) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  const csp = buildContentSecurityPolicy();
  const headerName = CSP_REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
  res.setHeader(headerName, csp);

  next();
};

export { createSecurityHeadersMiddleware, buildContentSecurityPolicy };
