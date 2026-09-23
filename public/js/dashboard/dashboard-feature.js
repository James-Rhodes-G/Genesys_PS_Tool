import { bindWidgetActions } from "./widget-host.js";
import { createDashboardWidgets } from "./widgets.js";
import { loadInventoryEntry } from "./inventory-store.js";
import {
  buildHealthCheckReport,
  HEALTH_CHECK_DEFINITIONS,
  resolveHealthCheckContext,
} from "./health-check-reports.js";
import { clearQueueMembersCache, loadAllQueueMembers } from "./queue-members-cache.js";

const createDashboardFeature = ({
  state,
  requireCredentials,
  startExportResult,
  finishExportResult,
  clearExportResults,
  renderLoadingState,
  getOrganizationName,
  getOrganizationId,
  getRegion,
  getConnectedAt,
  fetchUserSyncStatus,
  fetchCachedUsers,
  fetchSessionStatus,
  getCurrentUser,
  getOrganizationLimits,
  getTelephonyCallMetrics,
  loadCachedRoles,
  loadCachedQueues,
  loadCachedSkills,
  loadCachedGroups,
  getPrompts,
  getQueueMembers,
  loadCachedPhones,
  loadCachedDataTables,
  peekCachedPhones,
  syncSessionUsers,
}) => {
  let widgets = [];

  const dashboardDeps = {
    requireCredentials,
    getOrganizationName,
    getOrganizationId,
    getRegion,
    getConnectedAt,
    fetchUserSyncStatus,
    fetchCachedUsers,
    fetchSessionStatus,
    getCurrentUser,
    getOrganizationLimits,
    getTelephonyCallMetrics,
    loadCachedRoles,
    loadCachedQueues,
    loadCachedSkills,
    loadCachedGroups,
    getPrompts,
    getQueueMembers,
    loadCachedPhones,
    loadCachedDataTables,
    peekCachedPhones,
  };

  const openExport = (navId) => {
    const button = document.getElementById(navId);
    if (button && !button.disabled) {
      button.click();
    }
  };

  const openHealthCheckReport = async (checkId) => {
    const credentials = requireCredentials("Dashboard");
    if (!credentials) {
      return;
    }

    const definition = HEALTH_CHECK_DEFINITIONS.find((entry) => entry.id === checkId);
    if (!definition) {
      return;
    }

    const resultId = startExportResult(
      `Health Check: ${definition.issue}`,
      "Loading report...",
      renderLoadingState("Building health check report...")
    );

    try {
      const context = await resolveHealthCheckContext(dashboardDeps, credentials, checkId);
      const report = buildHealthCheckReport(checkId, context, resultId);
      await finishExportResult(resultId, report.title, report.status, "", report.exportMeta);
    } catch (error) {
      await finishExportResult(
        resultId,
        `Health Check: ${definition.issue}`,
        error.message || "Unable to build health check report",
        "",
        null
      );
    }
  };

  const loadResource = async (resourceKey) => {
    const credentials = requireCredentials("Dashboard");
    if (!credentials) {
      return;
    }

    if (resourceKey === "users") {
      await syncSessionUsers({ region: credentials.region, token: credentials.token, force: false });
      return;
    }

    if (resourceKey === "phones") {
      await loadCachedPhones(credentials);
      return;
    }

    if (resourceKey === "dataTables") {
      await loadCachedDataTables(credentials);
      return;
    }

    const loaders = {
      queues: () => loadCachedQueues(credentials),
      skills: () => loadCachedSkills(credentials),
      roles: () => loadCachedRoles(credentials),
      groups: () => loadCachedGroups(credentials),
      prompts: () => getPrompts(credentials),
    };

    const loader = loaders[resourceKey];
    if (loader) {
      await loadInventoryEntry(resourceKey, loader);
    }
  };

  const disposeDashboard = () => {
    widgets.forEach((widget) => widget.dispose());
    widgets = [];
    clearQueueMembersCache();
  };

  const loadQueueMembers = async () => {
    const credentials = requireCredentials("Dashboard");
    if (!credentials) {
      return;
    }

    await loadAllQueueMembers(dashboardDeps, credentials);
    const healthWidget = widgets.find((widget) => widget.id === "health-checks");
    if (healthWidget) {
      await healthWidget.refresh().catch(() => {});
    }
  };

  const renderDashboardBody = (resultId) =>
    `<div class="dashboard-page">
      <p class="muted dashboard-intro">Read-only organization health summary. Use View Report on health checks or existing navigation items to drill into detailed workflows.</p>
      <div class="dashboard-grid" id="${resultId}-dashboard-grid"></div>
    </div>`;

  const mountWidgets = async (resultId) => {
    disposeDashboard();
    const dashboardRootEl = document.getElementById(`${resultId}-dashboard-grid`);
    if (!dashboardRootEl) {
      return;
    }

    widgets = createDashboardWidgets(dashboardDeps);
    for (const widget of widgets) {
      await widget.initialize(dashboardRootEl);
      bindWidgetActions(widget.getContainer(), widget, {
        openExport,
        openHealthCheckReport,
        loadQueueMembers,
        loadResource: async (resourceKey) => {
          await loadResource(resourceKey);
          await Promise.all(widgets.map((entry) => entry.refresh().catch(() => {})));
        },
      });
      widget.load().catch(() => {});
    }
  };

  const openDashboard = async ({ replaceExisting = true } = {}) => {
    if (!state.hasConnection) {
      return;
    }

    if (replaceExisting) {
      disposeDashboard();
      clearExportResults();
    }

    const resultId = startExportResult(
      "Organization Dashboard",
      "Loading dashboard...",
      renderLoadingState("Initializing dashboard widgets...")
    );

    const exportMeta = {
      resultId,
      title: "Organization Dashboard",
      status: "Dashboard ready",
      exportType: "dashboard",
      hideActions: true,
      editable: false,
      rows: [],
      availableColumns: [],
      selectedColumnKeys: [],
      renderBody: () => renderDashboardBody(resultId),
    };

    state.exportData[resultId] = exportMeta;
    await finishExportResult(
      resultId,
      "Organization Dashboard",
      "Dashboard ready",
      renderDashboardBody(resultId),
      exportMeta
    );
    await mountWidgets(resultId);
  };

  const wireButton = (button, { hasConnection }) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!hasConnection()) {
        return;
      }

      await openDashboard();
    });
  };

  const refreshSessionActivity = () => {
    widgets.find((widget) => widget.id === "session-activity")?.refresh().catch(() => {});
  };

  return {
    wireButton,
    openDashboard,
    disposeDashboard,
    refreshSessionActivity,
    handleClick: async () => false,
  };
};

export { createDashboardFeature };
