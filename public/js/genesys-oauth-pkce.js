const OAUTH_STATE_KEY = "ps_tool_oauth_state";
const OAUTH_VERIFIER_KEY = "ps_tool_oauth_code_verifier";
const OAUTH_REGION_KEY = "ps_tool_oauth_region";
const OAUTH_AUTO_CONNECT_KEY = "ps_tool_oauth_auto_connect";
const OAUTH_PHASE_KEY = "ps_tool_oauth_phase";
const OAUTH_PENDING_ORG_PICKER_KEY = "ps_tool_oauth_pending_org_picker";
const OAUTH_TARGET_ORG_KEY = "ps_tool_oauth_target_org";
const OAUTH_INTENDED_ORG_KEY = "ps_tool_oauth_intended_org";
const OAUTH_INTENDED_ORG_NAME_KEY = "ps_tool_oauth_intended_org_name";
const OAUTH_ERROR_KEY = "ps_tool_oauth_error";

const OAUTH_PHASE_ORG_PICKER = "org-picker";
const OAUTH_PHASE_CONNECT = "connect";

const base64UrlEncode = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const generateRandomString = (length = 64) => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64UrlEncode(array).slice(0, length);
};

const generateCodeChallenge = async (verifier) => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
};

const getOAuthConfig = async () => {
  const response = await fetch("/api/genesys/oauth/config");
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "OAuth is not configured.");
  }

  return payload;
};

const formatOAuthRedirectError = (error, description = "") => {
  const normalized = String(description || error || "Authorization failed.").toLowerCase();

  if (normalized.includes("client has not been authorized for the organization")) {
    return "This OAuth client is not yet approved in the selected organization. In that organization, an admin must open Admin → Integrations → Authorized Applications and approve this app, or you must sign in again and select the client organization in Genesys when prompted to trust the application.";
  }

  return description || error || "Authorization failed.";
};

const readOAuthRedirectError = () => {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");

  if (!error) {
    return null;
  }

  return formatOAuthRedirectError(error, params.get("error_description") || "");
};

const clearOAuthSession = () => {
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_REGION_KEY);
  sessionStorage.removeItem(OAUTH_AUTO_CONNECT_KEY);
  sessionStorage.removeItem(OAUTH_PHASE_KEY);
  sessionStorage.removeItem(OAUTH_PENDING_ORG_PICKER_KEY);
  sessionStorage.removeItem(OAUTH_TARGET_ORG_KEY);
  sessionStorage.removeItem(OAUTH_INTENDED_ORG_KEY);
  sessionStorage.removeItem(OAUTH_INTENDED_ORG_NAME_KEY);
};

const getOAuthError = () => sessionStorage.getItem(OAUTH_ERROR_KEY) || "";

const clearOAuthError = () => {
  sessionStorage.removeItem(OAUTH_ERROR_KEY);
};

const setOAuthError = (message) => {
  if (!message) {
    clearOAuthError();
    return;
  }

  sessionStorage.setItem(OAUTH_ERROR_KEY, message);
};

const getOAuthIntendedOrganization = () => ({
  id: sessionStorage.getItem(OAUTH_INTENDED_ORG_KEY) || "",
  name: sessionStorage.getItem(OAUTH_INTENDED_ORG_NAME_KEY) || "",
});

const clearOAuthIntendedOrganization = () => {
  sessionStorage.removeItem(OAUTH_INTENDED_ORG_KEY);
  sessionStorage.removeItem(OAUTH_INTENDED_ORG_NAME_KEY);
};

const startPrimaryOrgLogin = async ({ region, domain }) => {
  const config = await getOAuthConfig();

  if (!config.primaryOrgId) {
    throw new Error(
      "Primary organization ID is not configured. Set GENESYS_PRIMARY_ORG_ID in the environment."
    );
  }

  clearOAuthIntendedOrganization();

  await startPkceLogin({
    region,
    domain,
    targetOrgId: config.primaryOrgId,
    phase: OAUTH_PHASE_ORG_PICKER,
  });
};

const startClientOrgLogin = async ({ region, domain, intendedOrgId, intendedOrgName = "" }) => {
  if (!intendedOrgId) {
    throw new Error("An organization must be selected before authorizing.");
  }

  sessionStorage.setItem(OAUTH_INTENDED_ORG_KEY, intendedOrgId);

  if (intendedOrgName) {
    sessionStorage.setItem(OAUTH_INTENDED_ORG_NAME_KEY, intendedOrgName);
  } else {
    sessionStorage.removeItem(OAUTH_INTENDED_ORG_NAME_KEY);
  }

  await startPkceLogin({
    region,
    domain,
    targetOrgId: intendedOrgId,
    phase: OAUTH_PHASE_CONNECT,
  });
};

const startPkceLogin = async ({ region, domain, targetOrgId, phase = OAUTH_PHASE_CONNECT }) => {
  if (!region || !domain) {
    throw new Error("Select a region before authorizing.");
  }

  const config = await getOAuthConfig();
  const codeVerifier = generateRandomString(96);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);

  sessionStorage.setItem(OAUTH_VERIFIER_KEY, codeVerifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  sessionStorage.setItem(OAUTH_REGION_KEY, region);
  sessionStorage.setItem(OAUTH_PHASE_KEY, phase);
  sessionStorage.removeItem(OAUTH_PENDING_ORG_PICKER_KEY);
  sessionStorage.removeItem(OAUTH_TARGET_ORG_KEY);
  sessionStorage.removeItem(OAUTH_AUTO_CONNECT_KEY);

  if (phase === OAUTH_PHASE_CONNECT) {
    sessionStorage.setItem(OAUTH_AUTO_CONNECT_KEY, "true");

    if (targetOrgId) {
      sessionStorage.setItem(OAUTH_TARGET_ORG_KEY, targetOrgId);
    }
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  if (config.scopes) {
    params.set("scope", config.scopes);
  }

  if (targetOrgId) {
    params.set("target", targetOrgId);
  }

  window.location.assign(`https://login.${domain}/oauth/authorize?${params.toString()}`);
};

const completePkceCallback = async () => {
  const redirectError = readOAuthRedirectError();

  if (redirectError) {
    throw new Error(redirectError);
  }

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");

  if (!code || !state) {
    throw new Error("Missing authorization code.");
  }

  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);

  if (!expectedState || expectedState !== state) {
    throw new Error("Invalid OAuth state.");
  }

  const codeVerifier = sessionStorage.getItem(OAUTH_VERIFIER_KEY);
  const region = sessionStorage.getItem(OAUTH_REGION_KEY);
  const phase = sessionStorage.getItem(OAUTH_PHASE_KEY) || OAUTH_PHASE_CONNECT;

  if (!codeVerifier || !region) {
    throw new Error("OAuth session expired. Try signing in again.");
  }

  const config = await getOAuthConfig();
  const response = await fetch("/api/genesys/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      region,
      code,
      codeVerifier,
      redirectUri: config.redirectUri,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Token exchange failed.");
  }

  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_PHASE_KEY);

  return {
    accessToken: payload.accessToken,
    region,
    phase,
  };
};

const markOAuthPendingOrgPicker = () => {
  sessionStorage.setItem(OAUTH_PENDING_ORG_PICKER_KEY, "true");
  sessionStorage.removeItem(OAUTH_AUTO_CONNECT_KEY);
};

const shouldAutoConnectAfterOAuth = () => sessionStorage.getItem(OAUTH_AUTO_CONNECT_KEY) === "true";

const shouldShowOrgPickerAfterOAuth = () => sessionStorage.getItem(OAUTH_PENDING_ORG_PICKER_KEY) === "true";

const clearOAuthAutoConnect = () => {
  sessionStorage.removeItem(OAUTH_AUTO_CONNECT_KEY);
  sessionStorage.removeItem(OAUTH_REGION_KEY);
  sessionStorage.removeItem(OAUTH_TARGET_ORG_KEY);
};

const clearOAuthPendingOrgPicker = () => {
  sessionStorage.removeItem(OAUTH_PENDING_ORG_PICKER_KEY);
};

export {
  clearOAuthAutoConnect,
  clearOAuthError,
  clearOAuthIntendedOrganization,
  clearOAuthPendingOrgPicker,
  clearOAuthSession,
  completePkceCallback,
  getOAuthConfig,
  getOAuthError,
  getOAuthIntendedOrganization,
  markOAuthPendingOrgPicker,
  OAUTH_PHASE_CONNECT,
  OAUTH_PHASE_ORG_PICKER,
  setOAuthError,
  shouldAutoConnectAfterOAuth,
  shouldShowOrgPickerAfterOAuth,
  startClientOrgLogin,
  startPkceLogin,
  startPrimaryOrgLogin,
};
