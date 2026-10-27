import { Router } from "express";
import {
  createLaunchCode as createLaunchCodeValue,
  createLinkToken,
  decryptToken,
  encryptToken,
  hashLinkToken,
} from "../lib/credential-vault.js";
import {
  createRateLimiter,
  validateHandoffBody,
  validatePairBody,
  validateStartBody,
  validateUnpairBody,
  verifyLaunchSignature,
} from "../lib/launch-validation.js";
import { getCurrentUser, getOrganizationMe } from "../lib/genesys.js";
import {
  consumeLaunchCode,
  createLaunchCode,
  getCredentialVault,
  revokeCredentialVault,
  upsertCredentialVault,
  upsertSessionCredentials,
  bindSessionConnection,
  clearSessionCredentials,
  clearSessionData,
} from "../data/session-db.js";
import { rotateSessionId } from "../middleware/session.js";
import { safeJsonForScript } from "../lib/safe-json-for-script.js";

const LAUNCH_VAULT_TTL_MS = Number(process.env.LAUNCH_VAULT_TTL_MS || 8 * 60 * 60 * 1000);
const LAUNCH_CODE_TTL_MS = Number(process.env.LAUNCH_CODE_TTL_MS || 60 * 1000);

const isLocalLaunchUrl = (baseUrl) => {
  try {
    const parsed = new URL(baseUrl);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

const resolveLaunchBaseUrl = (req) => {
  const configured = process.env.LAUNCH_BASE_URL || "";
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return `${req.protocol}://${req.get("host")}`;
};

const assertHttpsIfRequired = (baseUrl) => {
  if (isLocalLaunchUrl(baseUrl)) {
    return;
  }

  if (!baseUrl.startsWith("https://")) {
    throw new Error("HTTPS is required for launch pairing outside localhost.");
  }
};

const validateLaunchIdentity = async ({ region, token, orgId, userId }) => {
  const [organization, user] = await Promise.all([
    getOrganizationMe({ region, token }),
    getCurrentUser({ region, token }),
  ]);

  if (organization?.id !== orgId) {
    const error = new Error("Organization validation failed.");
    error.status = 401;
    throw error;
  }

  if (user?.id !== userId) {
    const error = new Error("User validation failed.");
    error.status = 401;
    throw error;
  }

  return { organization, user };
};

const storeVaultEntry = async (sessionDb, { region, token, organization, user }) => {
  const linkToken = createLinkToken();
  const linkId = hashLinkToken(linkToken);
  const expiresAt = Date.now() + LAUNCH_VAULT_TTL_MS;

  await upsertCredentialVault(sessionDb, {
    linkId,
    orgId: organization.id,
    orgName: organization.name || "",
    thirdPartyOrgName: organization.thirdPartyOrgName || "",
    region,
    userId: user.id,
    userName: user.username || user.email || "",
    userDisplayName: user.name || "",
    encryptedToken: encryptToken(token),
    expiresAt,
  });

  return { linkToken, linkId, expiresAt };
};

const createLaunchRouter = ({ sessionDb, recordEvent }) => {
  const router = Router();

  const audit = (req, payload) => {
    if (!recordEvent) return;
    recordEvent(req, { source: "extension", ...payload }).catch(() => {});
  };

  const pairRateLimit = createRateLimiter({
    limit: 10,
    windowMs: 15 * 60 * 1000,
    keyFn: (req) => req.ip || "unknown",
  });

  const handoffRateLimit = createRateLimiter({
    limit: 60,
    windowMs: 15 * 60 * 1000,
    keyFn: (req) => `${req.ip || "unknown"}:${String(req.body?.linkToken || "").slice(0, 8)}`,
  });

  const startRateLimit = createRateLimiter({
    limit: 30,
    windowMs: 15 * 60 * 1000,
    keyFn: (req) => req.ip || "unknown",
  });

  const launchGetRateLimit = createRateLimiter({
    limit: 30,
    windowMs: 15 * 60 * 1000,
    keyFn: (req) => req.ip || "unknown",
  });

  router.post("/api/launch/pair", pairRateLimit, async (req, res) => {
    if (!verifyLaunchSignature(req, req.body)) {
      res.status(401).json({ error: "Invalid launch signature." });
      return;
    }

    const validated = await validatePairBody(req.body);
    if (validated.error) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const { region, token, orgId, userId } = validated.value;

    try {
      const { organization, user } = await validateLaunchIdentity({ region, token, orgId, userId });
      const { linkToken, expiresAt } = await storeVaultEntry(sessionDb, {
        region,
        token,
        organization,
        user,
      });

      res.status(200).json({
        linkToken,
        org: {
          id: organization.id,
          name: organization.name || "",
          thirdPartyOrgName: organization.thirdPartyOrgName || "",
        },
        user: {
          id: user.id,
          username: user.username || user.email || "",
          name: user.name || "",
        },
        expiresAt,
      });
      audit(req, { action: "launch_pair", feature: "launch", status: "success", orgId: organization.id, userId: user.id, userName: user.name });
    } catch (error) {
      audit(req, { action: "launch_pair", feature: "launch", status: "failure", errorCode: error.message });
      res.status(error.status || 502).json({
        error: error.message || "Pairing failed.",
      });
    }
  });

  router.post("/api/launch/start", startRateLimit, async (req, res) => {
    if (!verifyLaunchSignature(req, req.body)) {
      res.status(401).json({ error: "Invalid launch signature." });
      return;
    }

    const validated = await validateStartBody(req.body);
    if (validated.error) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const { region, token, orgId, userId, feature, params } = validated.value;

    try {
      const { organization, user } = await validateLaunchIdentity({ region, token, orgId, userId });
      const { linkId } = await storeVaultEntry(sessionDb, { region, token, organization, user });

      const baseUrl = resolveLaunchBaseUrl(req);
      assertHttpsIfRequired(baseUrl);

      const code = createLaunchCodeValue();
      await createLaunchCode(sessionDb, {
        code,
        linkId,
        feature,
        paramsJson: JSON.stringify(params),
        expiresAt: Date.now() + LAUNCH_CODE_TTL_MS,
      });

      res.status(200).json({
        launchUrl: `${baseUrl}/launch?code=${encodeURIComponent(code)}`,
      });
      audit(req, {
        action: "launch_start",
        feature: "launch",
        status: "success",
        orgId: organization.id,
        userId: user.id,
        userName: user.name,
      });
    } catch (error) {
      audit(req, { action: "launch_start", feature: "launch", status: "failure", errorCode: error.message });
      res.status(error.status || 502).json({
        error: error.message || "Launch failed.",
      });
    }
  });

  router.post("/api/launch/handoff", handoffRateLimit, async (req, res) => {
    if (!verifyLaunchSignature(req, req.body)) {
      res.status(401).json({ error: "Invalid launch signature." });
      return;
    }

    const validated = validateHandoffBody(req.body);
    if (validated.error) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const { linkToken, feature, params } = validated.value;
    const linkId = hashLinkToken(linkToken);

    try {
      const vault = await getCredentialVault(sessionDb, linkId);
      if (!vault || vault.revoked || Date.now() > vault.expiresAt) {
        res.status(401).json({ error: "Invalid or expired link token." });
        return;
      }

      const baseUrl = resolveLaunchBaseUrl(req);
      assertHttpsIfRequired(baseUrl);

      const code = createLaunchCodeValue();
      await createLaunchCode(sessionDb, {
        code,
        linkId,
        feature,
        paramsJson: JSON.stringify(params),
        expiresAt: Date.now() + LAUNCH_CODE_TTL_MS,
      });

      res.status(200).json({
        code,
        launchUrl: `${baseUrl}/launch?code=${encodeURIComponent(code)}`,
      });
      audit(req, { action: "launch_handoff", feature: "launch", status: "success", orgId: vault.orgId, userId: vault.userId });
    } catch (error) {
      audit(req, { action: "launch_handoff", feature: "launch", status: "failure", errorCode: error.message });
      res.status(500).json({ error: error.message || "Handoff failed." });
    }
  });

  router.post("/api/launch/unpair", async (req, res) => {
    if (!verifyLaunchSignature(req, req.body)) {
      res.status(401).json({ error: "Invalid launch signature." });
      return;
    }

    const validated = validateUnpairBody(req.body);
    if (validated.error) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const linkId = hashLinkToken(validated.value.linkToken);
    await revokeCredentialVault(sessionDb, linkId);
    audit(req, { action: "launch_unpair", feature: "launch", status: "success" });
    res.status(200).json({ revoked: true });
  });

  router.get("/launch", launchGetRateLimit, async (req, res) => {
    const code = String(req.query?.code || "").trim();
    if (!code) {
      res.status(400).send("Launch code is required.");
      return;
    }

    const launchRecord = await consumeLaunchCode(sessionDb, code);
    if (!launchRecord) {
      audit(req, { action: "launch_consume", feature: "launch", status: "failure", errorCode: "invalid_or_expired" });
      res.status(400).send("Launch code is invalid or expired.");
      return;
    }

    const vault = await getCredentialVault(sessionDb, launchRecord.linkId);
    if (!vault || vault.revoked || Date.now() > vault.expiresAt) {
      res.status(401).send("Launch credentials are no longer valid.");
      return;
    }

    const sessionId = rotateSessionId(req, res);
    if (!sessionId) {
      res.status(400).send("Session is required.");
      return;
    }

    await upsertSessionCredentials(sessionDb, {
      sessionId,
      orgId: vault.orgId,
      orgName: vault.orgName,
      thirdPartyOrgName: vault.thirdPartyOrgName,
      region: vault.region,
      userId: vault.userId,
      userName: vault.userName,
      userDisplayName: vault.userDisplayName,
      encryptedToken: vault.encryptedToken,
      expiresAt: vault.expiresAt,
    });

    await bindSessionConnection(sessionDb, {
      sessionId,
      orgId: vault.orgId,
      orgName: vault.orgName || vault.thirdPartyOrgName || vault.orgId,
      region: vault.region,
    });

    let params = {};
    try {
      params = JSON.parse(launchRecord.paramsJson || "{}");
    } catch {
      params = {};
    }

    const bootstrap = {
      feature: launchRecord.feature,
      params,
      org: {
        id: vault.orgId,
        name: vault.orgName || "",
        thirdPartyOrgName: vault.thirdPartyOrgName || "",
      },
      user: {
        id: vault.userId,
        username: vault.userName || "",
        name: vault.userDisplayName || "",
      },
      region: vault.region,
      vaultMode: true,
    };

    const query = new URLSearchParams({ feature: launchRecord.feature });
    if (params.conversationId) {
      query.set("conversationId", params.conversationId);
    }

    res
      .status(200)
      .type("html")
      .send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Launching PS Tool</title>
</head>
<body>
  <p>Launching PS Tool...</p>
  <script>
    (function () {
      var payload = ${safeJsonForScript(bootstrap)};
      try {
        localStorage.setItem("ps_tool_region", payload.region || "");
        localStorage.setItem("ps_tool_org_id", payload.org.id || "");
        localStorage.setItem("ps_tool_org_name", payload.org.name || payload.org.thirdPartyOrgName || "");
        localStorage.setItem("ps_tool_user_id", payload.user.id || "");
        localStorage.setItem("ps_tool_user_name", payload.user.username || "");
        localStorage.setItem("ps_tool_user_display_name", payload.user.name || "");
        localStorage.setItem("ps_tool_connected", "true");
        localStorage.setItem("ps_tool_vault_mode", "true");
        localStorage.removeItem("ps_tool_token");
        document.documentElement.classList.add("vault-mode");
        document.body.classList.add("vault-mode");
        if (payload.params && payload.params.conversationId) {
          sessionStorage.setItem("ps_tool_launch_conversation_id", payload.params.conversationId);
        }
        sessionStorage.setItem("ps_tool_launch_feature", payload.feature || "");
      } catch (error) {
        console.error(error);
      }
      window.location.replace("/?" + ${JSON.stringify(query.toString())});
    })();
  </script>
</body>
</html>`);
    audit(req, { action: "launch_consume", feature: "launch", status: "success", orgId: vault.orgId, userId: vault.userId });
  });

  router.post("/api/launch/disconnect", async (req, res) => {
    if (!req.sessionId) {
      res.status(400).json({ error: "Session is required." });
      return;
    }

    await clearSessionCredentials(sessionDb, req.sessionId);
    await clearSessionData(sessionDb, req.sessionId);
    audit(req, { action: "launch_disconnect", feature: "launch", status: "success" });
    res.status(200).json({ cleared: true });
  });

  return router;
};

export { createLaunchRouter };
