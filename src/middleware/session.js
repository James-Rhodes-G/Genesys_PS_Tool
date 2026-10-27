import { buildLegacySessionClearCookie, buildSessionSetCookie, LEGACY_SESSION_COOKIE, sessionCookieName } from "../lib/session-cookie.js";
import { createSignedSessionId, parseSignedSessionId } from "../lib/session-token.js";

const SESSION_COOKIE = LEGACY_SESSION_COOKIE;

const parseCookieHeader = (header = "") => {
  if (!header) {
    return {};
  }

  return header.split(";").reduce((cookies, part) => {
    const trimmed = part.trim();
    if (!trimmed) {
      return cookies;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return cookies;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      return cookies;
    }
    cookies[key] = value;
    return cookies;
  }, {});
};

const appendSetCookie = (res, cookieValue) => {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookieValue);
    return;
  }

  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookieValue]);
    return;
  }

  res.setHeader("Set-Cookie", [existing, cookieValue]);
};

const readSessionTokenFromCookies = (cookies, req) => {
  const primary = cookies[sessionCookieName(req)];
  if (primary) {
    return primary;
  }
  return cookies[LEGACY_SESSION_COOKIE] || "";
};

const issueSessionCookie = (req, res) => {
  const signed = createSignedSessionId();
  appendSetCookie(res, buildSessionSetCookie(req, signed));
  if (sessionCookieName(req) !== LEGACY_SESSION_COOKIE) {
    appendSetCookie(res, buildLegacySessionClearCookie(req));
  }
  return parseSignedSessionId(signed);
};

const rotateSessionId = (req, res) => {
  const sessionId = issueSessionCookie(req, res);
  req.sessionId = sessionId;
  return sessionId;
};

const ensureSessionMiddleware = (req, res, next) => {
  const cookies = parseCookieHeader(req.headers.cookie);
  const rawToken = readSessionTokenFromCookies(cookies, req);
  const parsed = parseSignedSessionId(rawToken);

  if (parsed) {
    req.sessionId = parsed;
    next();
    return;
  }

  // /launch rotates the session once after binding vault credentials; avoid issuing a throwaway cookie first.
  if (req.path === "/launch") {
    req.sessionId = null;
    next();
    return;
  }

  req.sessionId = issueSessionCookie(req, res);
  next();
};

export { SESSION_COOKIE, ensureSessionMiddleware, issueSessionCookie, rotateSessionId };
