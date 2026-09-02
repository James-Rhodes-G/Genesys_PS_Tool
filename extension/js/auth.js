const REGION_DOMAIN_MAP = {
  "us-east-1": "mypurecloud.com",
  "us-east-2": "use2.us-gov-pure.cloud",
  "us-west-2": "usw2.pure.cloud",
  "ca-central-1": "cac1.pure.cloud",
  "sa-east-1": "sae1.pure.cloud",
  "mx-central-1": "mxc1.pure.cloud",
  "eu-central-1": "mypurecloud.de",
  "eu-west-1": "mypurecloud.ie",
  "eu-west-2": "euw2.pure.cloud",
  "eu-central-2": "euc2.pure.cloud",
  "me-central-1": "mec1.pure.cloud",
  "ap-south-1": "aps1.pure.cloud",
  "ap-northeast-1": "mypurecloud.jp",
  "ap-northeast-2": "apne2.pure.cloud",
  "ap-northeast-3": "apne3.pure.cloud",
  "ap-southeast-1": "apse1.pure.cloud",
  "ap-southeast-2": "mypurecloud.com.au",
};

const extractRegionIdFromAppsUrl = (origin) => {
  const hostname = new URL(origin).hostname;
  if (hostname.startsWith("apps.")) {
    const domain = hostname.slice("apps.".length);
    for (const [regionId, mappedDomain] of Object.entries(REGION_DOMAIN_MAP)) {
      if (mappedDomain === domain) {
        return regionId;
      }
    }
  }
  return "";
};

const readAuthFromTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url) {
    throw new Error("Open a Genesys Cloud tab to use PS Tool.");
  }

  const [{ result: sessionAuth }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      try {
        return sessionStorage.getItem("gcui_auth") || "";
      } catch {
        return "";
      }
    },
  });

  const token = String(sessionAuth || "").trim();
  if (!token) {
    throw new Error("Genesys auth token was not found in the active tab.");
  }

  const origin = new URL(tab.url).origin;
  const apiOrigin = origin.replace("apps.", "api.");
  const regionId = extractRegionIdFromAppsUrl(origin);
  if (!regionId) {
    throw new Error("Unable to determine Genesys region from the active tab.");
  }

  const orgResponse = await fetch(`${apiOrigin}/api/v2/organizations/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const orgPayload = await orgResponse.json();
  if (!orgResponse.ok) {
    throw new Error(orgPayload.message || "Failed to load organization details.");
  }

  const userResponse = await fetch(`${apiOrigin}/api/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const userPayload = await userResponse.json();
  if (!userResponse.ok) {
    throw new Error(userPayload.message || "Failed to load user details.");
  }

  return {
    token,
    regionId,
    apiOrigin,
    orgId: orgPayload.id,
    orgName: orgPayload.name || orgPayload.thirdPartyOrgName || orgPayload.id,
    userId: userPayload.id,
    userName: userPayload.username || userPayload.email || "",
    userDisplayName: userPayload.name || "",
    regionLabel: apiOrigin.replace("https://api.", ""),
  };
};

const maskToken = (token) => {
  if (!token || token.length < 8) {
    return "Unavailable";
  }
  return `••••${token.slice(-4)}`;
};

export { maskToken, readAuthFromTab };
