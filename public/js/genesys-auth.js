const TOKEN_KEY = "ps_tool_token";
const REGION_KEY = "ps_tool_region";
const CONNECTED_KEY = "ps_tool_connected";
const ORG_NAME_KEY = "ps_tool_org_name";
const ORG_ID_KEY = "ps_tool_org_id";
const PREFERRED_TARGET_ORG_KEY = "ps_tool_preferred_target_org";
const USER_ID_KEY = "ps_tool_user_id";
const USER_NAME_KEY = "ps_tool_user_name";
const USER_DISPLAY_NAME_KEY = "ps_tool_user_display_name";
const VAULT_MODE_KEY = "ps_tool_vault_mode";

const CONNECTED_AT_KEY = "ps_tool_connected_at";

const getToken = () => localStorage.getItem(TOKEN_KEY) || "";

const setToken = (token) => {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
};

const getRegion = () => localStorage.getItem(REGION_KEY) || "";

const setRegion = (region) => {
  if (!region) {
    localStorage.removeItem(REGION_KEY);
    return;
  }

  localStorage.setItem(REGION_KEY, region);
};

const isConnected = () => localStorage.getItem(CONNECTED_KEY) === "true";

const setConnected = (connected) => {
  if (connected) {
    localStorage.setItem(CONNECTED_KEY, "true");
    localStorage.setItem(CONNECTED_AT_KEY, String(Date.now()));
    return;
  }

  localStorage.removeItem(CONNECTED_KEY);
  localStorage.removeItem(CONNECTED_AT_KEY);
};

const getConnectedAt = () => {
  const value = Number(localStorage.getItem(CONNECTED_AT_KEY));
  return Number.isFinite(value) ? value : null;
};

const getOrganizationName = () => localStorage.getItem(ORG_NAME_KEY) || "";

const setOrganizationName = (name) => {
  if (!name) {
    localStorage.removeItem(ORG_NAME_KEY);
    return;
  }

  localStorage.setItem(ORG_NAME_KEY, name);
};

const getOrganizationId = () => localStorage.getItem(ORG_ID_KEY) || "";

const setOrganizationId = (organizationId) => {
  if (!organizationId) {
    localStorage.removeItem(ORG_ID_KEY);
    return;
  }

  localStorage.setItem(ORG_ID_KEY, organizationId);
};

const getPreferredTargetOrg = () => localStorage.getItem(PREFERRED_TARGET_ORG_KEY) || "";

const setPreferredTargetOrg = (organizationId) => {
  if (!organizationId) {
    localStorage.removeItem(PREFERRED_TARGET_ORG_KEY);
    return;
  }

  localStorage.setItem(PREFERRED_TARGET_ORG_KEY, organizationId);
};

const isVaultMode = () => localStorage.getItem(VAULT_MODE_KEY) === "true";

const hasApiCredentials = () => {
  const region = getRegion();
  if (!region) {
    return false;
  }

  if (isVaultMode()) {
    return isConnected();
  }

  return Boolean(getToken());
};

const setVaultMode = (enabled) => {
  if (enabled) {
    localStorage.setItem(VAULT_MODE_KEY, "true");
    return;
  }
  localStorage.removeItem(VAULT_MODE_KEY);
};

const getUserId = () => localStorage.getItem(USER_ID_KEY) || "";

const setUserId = (userId) => {
  if (!userId) {
    localStorage.removeItem(USER_ID_KEY);
    return;
  }
  localStorage.setItem(USER_ID_KEY, userId);
};

const getUserName = () => localStorage.getItem(USER_NAME_KEY) || "";

const setUserName = (userName) => {
  if (!userName) {
    localStorage.removeItem(USER_NAME_KEY);
    return;
  }
  localStorage.setItem(USER_NAME_KEY, userName);
};

const getUserDisplayName = () => localStorage.getItem(USER_DISPLAY_NAME_KEY) || "";

const setUserDisplayName = (displayName) => {
  if (!displayName) {
    localStorage.removeItem(USER_DISPLAY_NAME_KEY);
    return;
  }
  localStorage.setItem(USER_DISPLAY_NAME_KEY, displayName);
};

const clearVaultSession = () => {
  setVaultMode(false);
  setUserId("");
  setUserName("");
  setUserDisplayName("");
};

export {
  clearVaultSession,
  getConnectedAt,
  getOrganizationId,
  getOrganizationName,
  getPreferredTargetOrg,
  getRegion,
  getToken,
  getUserDisplayName,
  getUserId,
  getUserName,
  hasApiCredentials,
  isConnected,
  isVaultMode,
  setConnected,
  setOrganizationId,
  setOrganizationName,
  setPreferredTargetOrg,
  setRegion,
  setToken,
  setUserDisplayName,
  setUserId,
  setUserName,
  setVaultMode,
};
