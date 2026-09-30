import { decryptToken } from "../credential-vault.js";
import { getSessionCredentials } from "../../data/session-db.js";

const createTokenManager = ({
  region,
  token,
  sessionId = null,
  sessionDb = null,
  onRefresh = null,
} = {}) => {
  let cachedRegion = String(region || "").trim();
  let cachedToken = String(token || "").trim();
  let refreshPromise = null;

  const getRegion = () => cachedRegion;

  const getToken = async () => {
    if (!cachedToken) {
      throw new Error("Genesys token is required");
    }
    return cachedToken;
  };

  const invalidate = async () => {
    cachedToken = "";
  };

  const refresh = async () => {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      if (typeof onRefresh === "function") {
        const next = await onRefresh();
        if (next?.token) {
          cachedToken = String(next.token).trim();
          if (next.region) {
            cachedRegion = String(next.region).trim();
          }
          return cachedToken;
        }
      }

      if (sessionId && sessionDb) {
        const row = await getSessionCredentials(sessionDb, sessionId);
        if (!row || Date.now() > row.expiresAt) {
          throw new Error("Session credentials expired or unavailable.");
        }

        cachedRegion = String(row.region || cachedRegion).trim();
        cachedToken = decryptToken(row.encryptedToken);
        return cachedToken;
      }

      throw new Error("Unable to refresh Genesys token.");
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  };

  return {
    getRegion,
    getToken,
    invalidate,
    refresh,
  };
};

export { createTokenManager };
