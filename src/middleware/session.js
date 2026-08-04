import crypto from "crypto";

const SESSION_COOKIE = "ps_tool_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24;

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
    const value = decodeURIComponent(trimmed.slice(separatorIndex + 1).trim());
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

const ensureSessionMiddleware = (req, res, next) => {
  const cookies = parseCookieHeader(req.headers.cookie);
  let sessionId = cookies[SESSION_COOKIE];

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    appendSetCookie(
      res,
      `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
        SESSION_MAX_AGE_MS / 1000
      )}`
    );
  }

  req.sessionId = sessionId;
  next();
};

export { SESSION_COOKIE, ensureSessionMiddleware };
