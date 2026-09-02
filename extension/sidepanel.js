import { maskToken, readAuthFromTab } from "./js/auth.js";
import { isAppsSubdomainUrl } from "./js/apps-url.js";
import { CONVERSATION_FEATURES, FEATURE_MAP } from "./js/constants.js";
import { launchWebFeature } from "./js/launch.js";
import { wireQuickNavButtons } from "./js/quick-nav.js";

const CLOSE_PANEL_MESSAGE = "ps-tool-close-sidepanel";

const statusEl = document.getElementById("status");
const orgNameEl = document.getElementById("org-name");
const userNameEl = document.getElementById("user-name");
const orgIdEl = document.getElementById("org-id");
const regionLabelEl = document.getElementById("region-label");
const tokenMaskEl = document.getElementById("token-mask");
const conversationInput = document.getElementById("conversation-id");

let authContext = null;
let copyResetTimer = null;

const setStatus = (message, isError = false) => {
  statusEl.textContent = message || "";
  statusEl.classList.toggle("error", Boolean(isError));
};

const setCopyableValue = (element, displayValue, copyValue) => {
  if (!element) {
    return;
  }

  const hasValue = Boolean(copyValue);
  element.textContent = displayValue || "—";
  element.dataset.copy = copyValue || "";
  element.disabled = !hasValue;
  element.classList.remove("copied");
};

const copyText = async (value, element) => {
  if (!value) {
    return;
  }

  await navigator.clipboard.writeText(value);
  element.classList.add("copied");
  const label = element.id === "token-mask" ? "Token" : element.id === "org-id" ? "Org ID" : "Region";
  setStatus(`${label} copied.`);

  if (copyResetTimer) {
    clearTimeout(copyResetTimer);
  }

  copyResetTimer = setTimeout(() => {
    element.classList.remove("copied");
    if (statusEl.textContent.endsWith(" copied.")) {
      setStatus("");
    }
  }, 1500);
};

const wireCopyableFields = () => {
  [orgIdEl, regionLabelEl, tokenMaskEl].forEach((element) => {
    element.addEventListener("click", async () => {
      const value = element.dataset.copy || "";
      if (!value) {
        return;
      }

      try {
        await copyText(value, element);
      } catch (error) {
        setStatus(error.message || "Copy failed.", true);
      }
    });
  });
};

const wireSectionToggles = () => {
  document.querySelectorAll("[data-section-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.sectionToggle);
      if (!target) {
        return;
      }
      target.hidden = !target.hidden;
    });
  });
};

const setOpeningState = (button, opening) => {
  if (!button) {
    return;
  }
  button.disabled = opening;
  if (opening) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = "Opening...";
    return;
  }
  if (button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
  }
  button.disabled = false;
};

const handleFeatureClick = async (button) => {
  if (!authContext) {
    setStatus("Open a Genesys Cloud tab with an active session.", true);
    return;
  }

  const featureKey = button.dataset.feature;
  const feature = FEATURE_MAP[featureKey];
  if (!feature) {
    setStatus(`No web feature mapped for ${featureKey}.`, true);
    return;
  }

  const params = {};
  if (CONVERSATION_FEATURES.has(featureKey)) {
    const conversationId = conversationInput.value.trim();
    if (!conversationId) {
      setStatus("Enter a conversation ID first.", true);
      return;
    }
    params.conversationId = conversationId;
  }

  setOpeningState(button, true);
  setStatus("Opening PS Tool...");
  try {
    await launchWebFeature({ feature, params, authContext });
    setStatus("");
  } catch (error) {
    setStatus(error.message || "Launch failed.", true);
  } finally {
    setOpeningState(button, false);
  }
};

const wireFeatureButtons = () => {
  document.querySelectorAll("[data-feature]").forEach((button) => {
    button.addEventListener("click", () => {
      handleFeatureClick(button);
    });
  });
};

const maybeCloseForActiveTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab?.url && !isAppsSubdomainUrl(tab.url)) {
    window.close();
  }
};

const refreshAuth = async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab?.url && !isAppsSubdomainUrl(tab.url)) {
      window.close();
      return;
    }

    authContext = await readAuthFromTab();
    orgNameEl.textContent = authContext.orgName;
    userNameEl.textContent = authContext.userDisplayName || authContext.userName || "";
    setCopyableValue(orgIdEl, authContext.orgId, authContext.orgId);
    setCopyableValue(regionLabelEl, authContext.regionLabel, authContext.regionId);
    setCopyableValue(tokenMaskEl, maskToken(authContext.token), authContext.token);
    setStatus("");
  } catch (error) {
    authContext = null;
    orgNameEl.textContent = "Not connected";
    userNameEl.textContent = "";
    setCopyableValue(orgIdEl, "—", "");
    setCopyableValue(regionLabelEl, "—", "");
    setCopyableValue(tokenMaskEl, "—", "");
    setStatus(error.message || "Unable to read Genesys auth.", true);
  }
};

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === CLOSE_PANEL_MESSAGE) {
    window.close();
  }
});

wireSectionToggles();
wireCopyableFields();
wireFeatureButtons();
wireQuickNavButtons().catch((error) => setStatus(error.message, true));
maybeCloseForActiveTab();
refreshAuth();

chrome.tabs.onActivated.addListener(() => {
  refreshAuth();
});
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    refreshAuth();
  }
});
