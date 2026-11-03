import { isSecureRequest } from "../lib/session-cookie.js";

const CSP_REPORT_ONLY = String(process.env.CSP_REPORT_ONLY ?? "1") !== "0";

/** Genesys Cloud UI, Messenger bootstrap, Spark/GUX assets (all regions). */
const GENESYS_CSP_HOSTS = [
  "https://*.pure.cloud",
  "https://*.us-gov-pure.cloud",
  "https://*.mypurecloud.com",
  "https://*.mypurecloud.de",
  "https://*.mypurecloud.ie",
  "https://*.mypurecloud.jp",
  "https://*.mypurecloud.com.au",
  "https://*.mypurecloud.ca",
].join(" ");

const GOOGLE_FONTS_STYLE = "https://fonts.googleapis.com";
const GOOGLE_FONTS_FONT = "https://fonts.gstatic.com";

const buildContentSecurityPolicy = () => {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `frame-src 'self' ${GENESYS_CSP_HOSTS}`,
    `script-src 'self' 'unsafe-inline' ${GENESYS_CSP_HOSTS}`,
    `style-src 'self' 'unsafe-inline' ${GOOGLE_FONTS_STYLE} ${GENESYS_CSP_HOSTS}`,
    "img-src 'self' data: https:",
    `font-src 'self' data: ${GOOGLE_FONTS_FONT} ${GENESYS_CSP_HOSTS}`,
    "connect-src 'self' https: wss:",
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
