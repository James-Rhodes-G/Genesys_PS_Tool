import { escapeHtml, renderCacheStatus } from "./cache-utils.js";

const createDashboardWidget = ({
  id,
  title,
  className = "",
  initialize = async () => {},
  load = async () => {},
  refresh = async () => {},
  renderContent = () => "",
  dispose = () => {},
}) => {
  let containerEl = null;
  let state = {
    status: "idle",
    error: "",
    cachedAt: null,
    liveUpdatedAt: null,
  };

  const setState = (patch) => {
    state = { ...state, ...patch };
    paint();
  };

  const paint = () => {
    if (!containerEl) {
      return;
    }

    containerEl.innerHTML = `<div class="dashboard-widget ${escapeHtml(className)}" data-widget-id="${escapeHtml(id)}">
      <div class="dashboard-widget__header">
        <h3 class="dashboard-widget__title">${escapeHtml(title)}</h3>
      </div>
      <div class="dashboard-widget__body">${renderContent(state)}</div>
    </div>`;
  };

  return {
    id,
    title,
    initialize: async (hostContainer) => {
      containerEl = document.createElement("section");
      containerEl.className = "dashboard-widget-host";
      hostContainer.appendChild(containerEl);
      paint();
      await initialize({ setState, widgetRoot: containerEl });
    },
    load: async () => {
      setState({ status: "loading", error: "" });
      try {
        await load({ setState, getState: () => state });
        if (state.status === "loading") {
          setState({ status: "ready" });
        }
      } catch (error) {
        setState({
          status: "error",
          error: error.message || "Widget load failed",
        });
      }
    },
    refresh: async () => {
      setState({ status: "loading", error: "" });
      try {
        await refresh({ setState, getState: () => state });
        if (state.status === "loading") {
          setState({ status: "ready" });
        }
      } catch (error) {
        setState({
          status: "error",
          error: error.message || "Widget refresh failed",
        });
      }
    },
    render: (hostContainer) => {
      if (!containerEl) {
        containerEl = document.createElement("section");
        containerEl.className = "dashboard-widget-host";
        hostContainer.appendChild(containerEl);
      }
      paint();
    },
    dispose: () => {
      dispose();
      containerEl?.remove();
      containerEl = null;
    },
    getContainer: () => containerEl,
    getState: () => state,
    setState,
    paint,
  };
};

const bindWidgetActions = (rootEl, widget, handlers = {}) => {
  if (!rootEl) {
    return;
  }

  rootEl.addEventListener("click", async (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("[data-dashboard-action]") : null;
    if (!target || !rootEl.contains(target)) {
      return;
    }

    const action = target.getAttribute("data-dashboard-action");
    const widgetId = target.getAttribute("data-widget-id");
    if (widgetId && widgetId !== widget.id) {
      return;
    }

    event.preventDefault();

    if (action === "load") {
      await widget.load();
      return;
    }

    if (action === "refresh") {
      await widget.refresh();
      return;
    }

    if (action === "open-export") {
      const navId = target.getAttribute("data-export-nav-id");
      if (navId && typeof handlers.openExport === "function") {
        handlers.openExport(navId);
      }
      return;
    }

    if (action === "load-resource") {
      const resourceKey = target.getAttribute("data-resource-key");
      if (resourceKey && typeof handlers.loadResource === "function") {
        await handlers.loadResource(resourceKey);
        await widget.refresh();
      }
    }
  });
};

export { bindWidgetActions, createDashboardWidget, renderCacheStatus };
