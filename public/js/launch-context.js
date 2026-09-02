const LAUNCH_FEATURE_KEY = "ps_tool_launch_feature";
const LAUNCH_CONVERSATION_KEY = "ps_tool_launch_conversation_id";

const readLaunchContextFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const feature = params.get("feature") || "";
  const conversationId = params.get("conversationId") || "";

  if (!feature && !conversationId) {
    return null;
  }

  return { feature, conversationId };
};

const readStoredLaunchContext = () => {
  const feature = sessionStorage.getItem(LAUNCH_FEATURE_KEY) || "";
  const conversationId = sessionStorage.getItem(LAUNCH_CONVERSATION_KEY) || "";
  if (!feature && !conversationId) {
    return null;
  }
  return { feature, conversationId };
};

const clearStoredLaunchContext = () => {
  sessionStorage.removeItem(LAUNCH_FEATURE_KEY);
  sessionStorage.removeItem(LAUNCH_CONVERSATION_KEY);

  if (window.history?.replaceState) {
    const params = new URLSearchParams(window.location.search);
    params.delete("feature");
    params.delete("conversationId");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }
};

const captureLaunchContext = () => {
  const fromUrl = readLaunchContextFromUrl();
  if (fromUrl?.feature) {
    sessionStorage.setItem(LAUNCH_FEATURE_KEY, fromUrl.feature);
  }
  if (fromUrl?.conversationId) {
    sessionStorage.setItem(LAUNCH_CONVERSATION_KEY, fromUrl.conversationId);
    clearStoredLaunchContext.conversationOnly = fromUrl.conversationId;
  }

  const stored = readStoredLaunchContext();
  if (stored?.conversationId) {
    const input = document.getElementById("genesys-report-conversation-id");
    if (input) {
      input.value = stored.conversationId;
    }
  }

  if (fromUrl?.feature || fromUrl?.conversationId) {
    if (window.history?.replaceState) {
      const params = new URLSearchParams(window.location.search);
      params.delete("feature");
      params.delete("conversationId");
      const query = params.toString();
      const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }

  return stored;
};

const openNavGroupForFeature = (featureId) => {
  const nav = document.getElementById("app-global-nav");
  const button = document.getElementById(featureId);
  if (!nav || !button) {
    return;
  }

  const submenuPanel = button.closest("[data-submenu-panel]");
  const groupId = submenuPanel?.dataset?.submenuPanel;
  if (groupId) {
    const toggle = nav.querySelector(`[data-nav-group="${groupId}"] [data-nav-group-toggle]`);
    if (toggle) {
      toggle.click();
    }
  }
};

const applyLaunchContext = async ({ isConnected, openDashboardAfterConnect }) => {
  const context = readStoredLaunchContext();
  if (!context?.feature || !isConnected) {
    return false;
  }

  clearStoredLaunchContext();

  if (context.conversationId) {
    const input = document.getElementById("genesys-report-conversation-id");
    if (input) {
      input.value = context.conversationId;
    }
  }

  openNavGroupForFeature(context.feature);

  const button = document.getElementById(context.feature);
  if (button) {
    button.click();
    return true;
  }

  if (openDashboardAfterConnect) {
    await openDashboardAfterConnect(true);
  }

  return false;
};

export { applyLaunchContext, captureLaunchContext, readStoredLaunchContext };
