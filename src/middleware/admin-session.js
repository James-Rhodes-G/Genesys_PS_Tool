import {
  createAdminSessionToken,
  hashAdminSessionToken,
} from "../lib/admin-operator-auth.js";
import {
  createOperatorSession,
  deleteOperatorSession,
  getOperatorSession,
  touchOperatorSession,
} from "../data/admin-db.js";

const ADMIN_SESSION_COOKIE = "ps_tool_admin_session";
const DEFAULT_SESSION_TTL_MS = Number(process.env.PS_TOOL_ADMIN_SESSION_TTL_MS || 8 * 60 * 60 * 1000);

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

const buildSessionCookie = (token, { maxAgeMs = DEFAULT_SESSION_TTL_MS } = {}) => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
    maxAgeMs / 1000
  )}${secure}`;
};

const clearSessionCookie = () => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
};

const createLoadAdminSessionMiddleware = (adminDb) => async (req, _res, next) => {
  req.adminOperator = null;

  if (!adminDb) {
    next();
    return;
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  const rawToken = cookies[ADMIN_SESSION_COOKIE];
  if (!rawToken) {
    next();
    return;
  }

  try {
    const tokenHash = hashAdminSessionToken(rawToken);
    const session = await getOperatorSession(adminDb, tokenHash);
    if (!session || Date.now() > session.expiresAt) {
      if (session) {
        await deleteOperatorSession(adminDb, tokenHash);
      }
      next();
      return;
    }

    await touchOperatorSession(adminDb, tokenHash);
    req.adminOperator = {
      id: session.operatorId,
      username: session.username,
      sessionTokenHash: tokenHash,
    };
  } catch (error) {
    console.warn("[admin-session] failed to load session:", error.message);
  }

  next();
};

const requireAdminSession = (req, res, next) => {
  if (req.adminOperator?.username) {
    next();
    return;
  }
  res.status(403).json({
    error: "Administrator login required.",
    code: "ADMIN_LOGIN_REQUIRED",
  });
};

const issueAdminSession = async (adminDb, res, { operatorId, username }) => {
  const token = createAdminSessionToken();
  const tokenHash = hashAdminSessionToken(token);
  const expiresAt = Date.now() + DEFAULT_SESSION_TTL_MS;
  await createOperatorSession(adminDb, {
    tokenHash,
    operatorId,
    username,
    expiresAt,
  });
  appendSetCookie(res, buildSessionCookie(token));
  return { username, expiresAt };
};

const revokeAdminSession = async (adminDb, req, res) => {
  if (req.adminOperator?.sessionTokenHash) {
    await deleteOperatorSession(adminDb, req.adminOperator.sessionTokenHash);
  }
  appendSetCookie(res, clearSessionCookie());
};

export {
  ADMIN_SESSION_COOKIE,
  createLoadAdminSessionMiddleware,
  issueAdminSession,
  requireAdminSession,
  revokeAdminSession,
};
