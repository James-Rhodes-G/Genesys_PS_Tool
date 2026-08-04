import { setRegion, setToken } from "./genesys-auth.js";
import {
  clearOAuthSession,
  completePkceCallback,
  markOAuthPendingOrgPicker,
  OAUTH_PHASE_ORG_PICKER,
  setOAuthError,
} from "./genesys-oauth-pkce.js";

const statusEl = document.getElementById("status");

const showError = (message) => {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.classList.add("error");
  }
};

const run = async () => {
  try {
    const { accessToken, region, phase } = await completePkceCallback();

    if (!accessToken) {
      throw new Error("No access token was returned.");
    }

    setToken(accessToken);
    setRegion(region);

    if (phase === OAUTH_PHASE_ORG_PICKER) {
      markOAuthPendingOrgPicker();
    }

    window.location.replace("/");
  } catch (error) {
    clearOAuthSession();
    setOAuthError(error.message || "Authorization failed.");
    markOAuthPendingOrgPicker();
    window.location.replace("/");
  }
};

run();
