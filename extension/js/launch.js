import { signedFetch } from "./sign.js";

const STORAGE_KEYS = {
  webAppBaseUrl: "webAppBaseUrl",
  hmacSecret: "hmacSecret",
};

const DEFAULT_BASE_URL = "http://localhost:3000";

const getSettings = async () => {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.webAppBaseUrl, STORAGE_KEYS.hmacSecret]);

  return {
    baseUrl: (stored.webAppBaseUrl || DEFAULT_BASE_URL).replace(/\/$/, ""),
    hmacSecret: stored.hmacSecret || "",
  };
};

export const launchWebFeature = async ({ feature, params = {}, authContext }) => {
  const settings = await getSettings();
  const response = await signedFetch({
    baseUrl: settings.baseUrl,
    path: "/api/launch/start",
    method: "POST",
    secret: settings.hmacSecret,
    body: {
      region: authContext.regionId,
      token: authContext.token,
      orgId: authContext.orgId,
      userId: authContext.userId,
      feature,
      params,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Launch failed.");
  }

  if (!payload.launchUrl) {
    throw new Error("Launch URL missing from server response.");
  }

  await chrome.tabs.create({ url: payload.launchUrl, active: true });
};

export { getSettings, STORAGE_KEYS };
