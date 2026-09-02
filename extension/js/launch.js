import { signedFetch } from "./sign.js";

const STORAGE_KEYS = {
  linkToken: "linkToken",
  pairContext: "pairContext",
  webAppBaseUrl: "webAppBaseUrl",
  hmacSecret: "hmacSecret",
};

const DEFAULT_BASE_URL = "http://localhost:3000";

const getSettings = async () => {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.webAppBaseUrl,
    STORAGE_KEYS.hmacSecret,
    STORAGE_KEYS.linkToken,
    STORAGE_KEYS.pairContext,
  ]);

  return {
    baseUrl: (stored.webAppBaseUrl || DEFAULT_BASE_URL).replace(/\/$/, ""),
    hmacSecret: stored.hmacSecret || "",
    linkToken: stored.linkToken || "",
    pairContext: stored.pairContext || null,
  };
};

const credentialsChanged = (pairContext, nextContext) => {
  if (!pairContext) {
    return true;
  }

  return (
    pairContext.token !== nextContext.token ||
    pairContext.region !== nextContext.region ||
    pairContext.orgId !== nextContext.orgId ||
    pairContext.userId !== nextContext.userId
  );
};

export const pairWithWebApp = async (authContext) => {
  const settings = await getSettings();
  const response = await signedFetch({
    baseUrl: settings.baseUrl,
    path: "/api/launch/pair",
    method: "POST",
    secret: settings.hmacSecret,
    body: {
      region: authContext.regionId,
      token: authContext.token,
      orgId: authContext.orgId,
      userId: authContext.userId,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Pairing failed.");
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.linkToken]: payload.linkToken,
    [STORAGE_KEYS.pairContext]: {
      token: authContext.token,
      region: authContext.regionId,
      orgId: authContext.orgId,
      userId: authContext.userId,
    },
  });

  return payload.linkToken;
};

export const launchWebFeature = async ({ feature, params = {}, authContext }) => {
  const settings = await getSettings();
  let linkToken = settings.linkToken;

  if (!linkToken || credentialsChanged(settings.pairContext, authContext)) {
    linkToken = await pairWithWebApp(authContext);
  }

  const response = await signedFetch({
    baseUrl: settings.baseUrl,
    path: "/api/launch/handoff",
    method: "POST",
    secret: settings.hmacSecret,
    body: {
      linkToken,
      feature,
      params,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      await chrome.storage.local.remove([STORAGE_KEYS.linkToken, STORAGE_KEYS.pairContext]);
    }
    throw new Error(payload.error || "Launch handoff failed.");
  }

  await chrome.tabs.create({ url: payload.launchUrl, active: true });
};

export { getSettings, STORAGE_KEYS };
