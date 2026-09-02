import { isAppsSubdomainUrl } from "./js/apps-url.js";

const CLOSE_PANEL_MESSAGE = "ps-tool-close-sidepanel";

const syncSidePanelForTab = async (tab) => {
  if (!tab?.id || !tab.url) {
    return;
  }

  const onApps = isAppsSubdomainUrl(tab.url);

  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: "sidepanel.html",
    enabled: onApps,
  });

  if (!onApps) {
    chrome.runtime.sendMessage({ type: CLOSE_PANEL_MESSAGE }).catch(() => {});
  }
};

const syncAllTabs = async () => {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => syncSidePanelForTab(tab)));
};

const initSidePanelBehavior = async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await chrome.sidePanel.setOptions({ enabled: true });
  await syncAllTabs();
};

chrome.runtime.onInstalled.addListener(() => {
  initSidePanelBehavior().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  initSidePanelBehavior().catch(() => {});
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") {
    return;
  }

  syncSidePanelForTab(tab).catch(() => {});
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await syncSidePanelForTab(tab);
  } catch {
    // Tab may have closed before lookup completes.
  }
});
