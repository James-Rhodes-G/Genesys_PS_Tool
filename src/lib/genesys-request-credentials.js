import { isManualAuthAllowed } from "./security-policy.js";

const VAULT_SESSION_REQUIRED = {
  status: 401,
  error: "Genesys session expired or missing. Re-launch this feature from the PS Tool Chrome extension.",
  code: "VAULT_SESSION_REQUIRED",
};

const resolveGenesysCredentials = (req) => {
  if (req.genesysCredentials?.region && req.genesysCredentials?.token) {
    return { credentials: req.genesysCredentials, vaultOnly: false };
  }

  if (!isManualAuthAllowed()) {
    return { credentials: null, vaultOnly: true };
  }

  const region = req.body?.region || req.query?.region || req.get("x-genesys-region");
  const token = req.body?.token || req.query?.token || req.get("x-genesys-token");

  if (!region || !token) {
    return { credentials: null, vaultOnly: false };
  }

  return { credentials: { region, token }, vaultOnly: false };
};

const requireGenesysCredentials = (req, res) => {
  const resolved = resolveGenesysCredentials(req);

  if (resolved.credentials) {
    return resolved.credentials;
  }

  if (resolved.vaultOnly) {
    res.status(VAULT_SESSION_REQUIRED.status).json({
      error: VAULT_SESSION_REQUIRED.error,
      code: VAULT_SESSION_REQUIRED.code,
    });
    return null;
  }

  res.status(400).json({ error: "Both region and token are required." });
  return null;
};

export { requireGenesysCredentials, resolveGenesysCredentials, VAULT_SESSION_REQUIRED };
