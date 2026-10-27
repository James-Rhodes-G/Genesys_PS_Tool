const SESSION_MAX_AGE_SEC = Math.floor((1000 * 60 * 60 * 24) / 1000);

const isSecureRequest = (req) => {
  if (process.env.NODE_ENV === "production") {
    return true;
  }
  if (req.secure) {
    return true;
  }
  const proto = String(req.get("x-forwarded-proto") || "").toLowerCase();
  return proto === "https";
};

const sessionCookieName = (req) => (isSecureRequest(req) ? "__Host-ps_tool_session" : "ps_tool_session");

const LEGACY_SESSION_COOKIE = "ps_tool_session";

const buildSessionSetCookie = (req, signedSessionValue) => {
  const secure = isSecureRequest(req) ? "; Secure" : "";
  const name = sessionCookieName(req);
  return `${name}=${encodeURIComponent(signedSessionValue)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SEC}${secure}`;
};

const buildLegacySessionClearCookie = (req) => {
  const secure = isSecureRequest(req) ? "; Secure" : "";
  return `${LEGACY_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
};

export {
  LEGACY_SESSION_COOKIE,
  buildLegacySessionClearCookie,
  buildSessionSetCookie,
  isSecureRequest,
  sessionCookieName,
};
