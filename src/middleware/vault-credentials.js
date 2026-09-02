import { decryptToken } from "../lib/credential-vault.js";
import { getSessionCredentials } from "../data/session-db.js";

const createVaultCredentialsMiddleware = (sessionDb) => async (req, _res, next) => {
  req.genesysCredentials = null;

  if (!sessionDb || !req.sessionId) {
    next();
    return;
  }

  try {
    const row = await getSessionCredentials(sessionDb, req.sessionId);
    if (!row || Date.now() > row.expiresAt) {
      next();
      return;
    }

    req.genesysCredentials = {
      region: row.region,
      token: decryptToken(row.encryptedToken),
      orgId: row.orgId,
      userName: row.userName,
      userDisplayName: row.userDisplayName,
      vaultMode: true,
    };
  } catch (error) {
    console.warn("[vault] failed to resolve session credentials:", error.message);
  }

  next();
};

export { createVaultCredentialsMiddleware };
