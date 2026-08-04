const TOKEN_KEY = "ps_tool_token";
const REGION_KEY = "ps_tool_region";
const CONNECTED_KEY = "ps_tool_connected";
const ORG_NAME_KEY = "ps_tool_org_name";
const ORG_ID_KEY = "ps_tool_org_id";
const PREFERRED_TARGET_ORG_KEY = "ps_tool_preferred_target_org";

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
    return;
  }

  localStorage.removeItem(CONNECTED_KEY);
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

export {
  getOrganizationId,
  getOrganizationName,
  getPreferredTargetOrg,
  getRegion,
  getToken,
  isConnected,
  setConnected,
  setOrganizationId,
  setOrganizationName,
  setPreferredTargetOrg,
  setRegion,
  setToken,
};
