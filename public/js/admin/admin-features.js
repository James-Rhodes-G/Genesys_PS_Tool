import {
  fetchDashboardSummary,
  fetchPresence,
  fetchMockApiTraffic,
  fetchStorage,
  fetchPlatform,
  fetchCoreApi,
  fetchConnectedUsers,
  fetchAdminEvents,
  fetchDangerousActions,
  fetchLaunchFunnel,
  fetchSessions,
  fetchUsage,
  fetchCompliance,
  fetchMockApiEndpoints,
  fetchJobs,
  fetchBackups,
  fetchMaintenance,
  setMaintenance,
  revokeSession,
  revokeVault,
  pauseEndpoint,
  activateEndpoint,
  deleteEndpoint,
  runBackup,
  runSnapshots,
  fetchActivity,
} from "./admin-client.js";
import { renderGuxTable } from "../gux-ui.js";

const PAGE_SIZE = 25;

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatTimestamp = (value) => (value ? new Date(value).toLocaleString() : "—");
const formatBytes = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
};

const renderStatGrid = (stats) =>
  `<div class="admin-stat-grid">${stats
    .map((s) => `<div class="admin-stat"><span>${escapeHtml(s.label)}</span><strong>${escapeHtml(s.value)}</strong></div>`)
    .join("")}</div>`;

const renderSimpleTable = (columns, rows, { renderCell } = {}) =>
  renderGuxTable({
    columns: columns.map((column) => ({
      key: column.key,
      header: column.header || column.label || column.key,
    })),
    rows,
    emptyMessage: "No data.",
    escapeHtml,
    renderCell:
      renderCell ||
      ((column, row) => {
        const value = row[column.key];
        if (column.allowHtml) {
          return value ?? "";
        }
        return escapeHtml(value ?? "");
      }),
  });

const renderRangePicker = (id, selected = "24h") =>
  `<div class="admin-range-picker">
    <label for="${id}">Time range</label>
    <select id="${id}" class="admin-range-select">
      ${["1h", "24h", "7d", "30d"]
        .map((r) => `<option value="${r}"${r === selected ? " selected" : ""}>${r}</option>`)
        .join("")}
    </select>
  </div>`;

const renderPagination = (page, pageSize, total, prefix) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return `<div class="admin-pagination">
    <span class="muted">Page ${page + 1} of ${totalPages} (${total} total)</span>
    <button type="button" class="admin-action" data-admin-action="${prefix}-prev" ${page <= 0 ? "disabled" : ""}>Previous</button>
    <button type="button" class="admin-action" data-admin-action="${prefix}-next" ${page + 1 >= totalPages ? "disabled" : ""}>Next</button>
  </div>`;
};

const renderActionButton = (label, action, attrs = "", danger = false) =>
  `<button type="button" class="admin-action${danger ? " admin-action--danger" : ""}" data-admin-action="${action}" ${attrs}>${escapeHtml(label)}</button>`;

const createAdminFeatures = ({ startExportResult, finishExportResult, renderLoadingState, confirmModal }) => {
  const buttonMap = new Map();
  const featureState = {
    audit: { page: 0, userName: "", orgId: "" },
    coreApi: { page: 0 },
    activePanelId: null,
  };

  const wireButton = (button, handler) => {
    if (!button) return;
    buttonMap.set(button.id, handler);
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      await handler();
    });
  };

  const reopenActivePanel = async () => {
    const handler = panels[featureState.activePanelId];
    if (handler) {
      await handler();
    }
  };

  const handlePanelAction = async (actionEl) => {
    const action = actionEl.getAttribute("data-admin-action");
    if (!action) return;

    if (action === "audit-search") {
      const form = actionEl.closest(".admin-search-form");
      featureState.audit.userName = form?.querySelector('[name="userName"]')?.value?.trim() || "";
      featureState.audit.orgId = form?.querySelector('[name="orgId"]')?.value?.trim() || "";
      featureState.audit.page = 0;
      await panels["genesys-admin-audit-log"]();
      return;
    }

    if (action === "audit-clear") {
      featureState.audit.userName = "";
      featureState.audit.orgId = "";
      featureState.audit.page = 0;
      await panels["genesys-admin-audit-log"]();
      return;
    }

    if (action === "audit-prev") {
      featureState.audit.page = Math.max(0, featureState.audit.page - 1);
      await panels["genesys-admin-audit-log"]();
      return;
    }

    if (action === "audit-next") {
      featureState.audit.page += 1;
      await panels["genesys-admin-audit-log"]();
      return;
    }

    if (action === "core-api-prev") {
      featureState.coreApi.page = Math.max(0, featureState.coreApi.page - 1);
      await panels["genesys-admin-server-health"]();
      return;
    }

    if (action === "core-api-next") {
      featureState.coreApi.page += 1;
      await panels["genesys-admin-server-health"]();
      return;
    }

    if (action === "pause-endpoint") {
      const endpointId = actionEl.getAttribute("data-endpoint-id");
      if (!endpointId) return;
      if (!window.confirm("Pause this mock API endpoint for all users?")) return;
      await pauseEndpoint(endpointId);
      await panels["genesys-admin-endpoint-registry"]();
      return;
    }

    if (action === "activate-endpoint") {
      const endpointId = actionEl.getAttribute("data-endpoint-id");
      if (!endpointId) return;
      await activateEndpoint(endpointId);
      await panels["genesys-admin-endpoint-registry"]();
      return;
    }

    if (action === "delete-endpoint") {
      const endpointId = actionEl.getAttribute("data-endpoint-id");
      if (!endpointId) return;
      if (!window.confirm("Permanently delete this mock API endpoint?")) return;
      await deleteEndpoint(endpointId);
      await panels["genesys-admin-endpoint-registry"]();
      return;
    }

    if (action === "revoke-session") {
      const sessionId = actionEl.getAttribute("data-session-id");
      if (!sessionId) return;
      if (!window.confirm("Remove this active session and clear credentials?")) return;
      await revokeSession(sessionId);
      await panels["genesys-admin-sessions"]();
      return;
    }

    if (action === "revoke-vault") {
      const linkId = actionEl.getAttribute("data-link-id");
      if (!linkId) return;
      if (!window.confirm("Revoke this credential vault link?")) return;
      await revokeVault(linkId);
      await panels["genesys-admin-sessions"]();
      return;
    }

    if (action === "run-backup") {
      await runBackup();
      await panels["genesys-admin-server-health"]();
      return;
    }

    if (action === "run-snapshots") {
      await runSnapshots();
      await panels["genesys-admin-storage"]();
    }
  };

  const handleClick = async (event) => {
    const actionEl = event.target.closest("[data-admin-action]");
    if (actionEl) {
      event.preventDefault();
      event.stopPropagation();
      await handlePanelAction(actionEl);
      return true;
    }

    const button = event.target.closest("button[id]");
    if (!button || !buttonMap.has(button.id)) return false;
    event.preventDefault();
    await buttonMap.get(button.id)();
    return true;
  };

  const showPanel = async (title, renderFn, panelId) => {
    if (panelId) {
      featureState.activePanelId = panelId;
    }
    const loadingResultId = startExportResult(
      title,
      "Loading...",
      renderLoadingState("Loading admin data...")
    );
    try {
      const html = await renderFn();
      await finishExportResult(loadingResultId, title, "Ready", html);
    } catch (error) {
      await finishExportResult(
        loadingResultId,
        title,
        "Error",
        `<p class="error">${escapeHtml(error.message)}</p>`
      );
    }
  };

  const renderOperationsDashboard = async (range = "24h") => {
    const [summary, presence, mockTraffic, storage, platform, users] = await Promise.all([
      fetchDashboardSummary(),
      fetchPresence(range),
      fetchMockApiTraffic(range),
      fetchStorage(range),
      fetchPlatform(range),
      fetchConnectedUsers(),
    ]);

    const peakUsers = (presence.snapshots || []).reduce((max, s) => Math.max(max, s.uniqueUsers || 0), 0);
    const peakSessions = (presence.snapshots || []).reduce((max, s) => Math.max(max, s.connectedSessions || 0), 0);

    return `<div class="admin-panel">
      <div class="admin-panel__header">
        <h2>Operations Dashboard</h2>
        ${renderRangePicker("admin-ops-range", range)}
      </div>
      <section class="admin-section">
        <h3>Connected Users (live)</h3>
        ${renderStatGrid([
          { label: "Unique users", value: String(summary.connected?.uniqueUsers ?? 0) },
          { label: "Active sessions", value: String(summary.connected?.activeSessions ?? 0) },
          { label: "Connected orgs", value: String(summary.connected?.connectedOrgs ?? 0) },
        ])}
        ${renderSimpleTable(
          [
            { key: "user", label: "User" },
            { key: "org", label: "Org" },
            { key: "region", label: "Region" },
            { key: "authMode", label: "Auth" },
            { key: "connectedAt", label: "Connected" },
          ],
          (users.users || []).slice(0, 20).map((u) => ({
            user: u.userDisplayName || u.userName || u.userId || "—",
            org: u.orgName || u.orgId,
            region: u.region || "—",
            authMode: u.authMode,
            connectedAt: formatTimestamp(u.connectedAt),
          }))
        )}
      </section>
      <section class="admin-section">
        <h3>Peak Connected Users (${range})</h3>
        ${renderStatGrid([
          { label: "Peak unique users", value: String(peakUsers) },
          { label: "Peak sessions", value: String(peakSessions) },
        ])}
      </section>
      <section class="admin-section">
        <h3>Mock API Traffic</h3>
        ${renderStatGrid([
          { label: "Calls", value: String(mockTraffic.totals?.calls ?? summary.mockApi24h?.calls ?? 0) },
          { label: "Request bytes", value: formatBytes(mockTraffic.totals?.requestBytes) },
          { label: "Response bytes", value: formatBytes(mockTraffic.totals?.responseBytes) },
          { label: "Errors", value: String(mockTraffic.totals?.errors ?? 0) },
        ])}
      </section>
      <section class="admin-section">
        <h3>Database & Storage</h3>
        ${renderStatGrid([
          { label: "session.db", value: formatBytes(storage.current?.sessionDbBytes) },
          { label: "mock-api.db", value: formatBytes(storage.current?.mockApiDbBytes) },
          { label: "admin.db", value: formatBytes(storage.current?.adminDbBytes) },
          { label: "Total", value: formatBytes(
            (storage.current?.sessionDbBytes || 0) +
            (storage.current?.mockApiDbBytes || 0) +
            (storage.current?.adminDbBytes || 0) +
            (storage.current?.logsDbBytes || 0)
          ) },
        ])}
      </section>
      <section class="admin-section">
        <h3>Platform Health</h3>
        ${renderStatGrid([
          { label: "Uptime", value: `${summary.uptimeSeconds ?? 0}s` },
          { label: "Version", value: summary.version || "dev" },
          { label: "Environment", value: summary.environment || "development" },
          { label: "Disk free", value: formatBytes(platform.current?.diskFreeBytes) },
          { label: "Heap used", value: formatBytes(platform.current?.memoryHeapBytes) },
          { label: "Maintenance", value: summary.maintenance || "off" },
        ])}
      </section>
    </div>`;
  };

  const renderAuditLog = async () => {
    const offset = featureState.audit.page * PAGE_SIZE;
    const { events, total } = await fetchAdminEvents({
      limit: PAGE_SIZE,
      offset,
      userName: featureState.audit.userName || undefined,
      orgId: featureState.audit.orgId || undefined,
    });

    return `<div class="admin-panel"><h2>PS Tool Audit Log</h2>
      <p class="muted">Showing all recorded events. Use search to filter by username or org ID.</p>
      <form class="admin-search-form" data-admin-form="audit">
        <label>Username<input name="userName" type="text" value="${escapeHtml(featureState.audit.userName)}" placeholder="Search by username" /></label>
        <label>Org ID<input name="orgId" type="text" value="${escapeHtml(featureState.audit.orgId)}" placeholder="Search by org ID" /></label>
        <button type="button" class="admin-action" data-admin-action="audit-search">Search</button>
        <button type="button" class="admin-action" data-admin-action="audit-clear">Clear</button>
      </form>
      ${renderPagination(featureState.audit.page, PAGE_SIZE, total, "audit")}
      ${events.length === 0
        ? '<p class="muted">No audit events found. Events are recorded when users perform actions (exports, bulk changes, mock API edits, connect/disconnect, etc.).</p>'
        : renderSimpleTable(
        [
          { key: "timestamp", label: "Time" },
          { key: "action", label: "Action" },
          { key: "user", label: "User" },
          { key: "org", label: "Org" },
          { key: "feature", label: "Feature" },
          { key: "status", label: "Status" },
          { key: "detail", label: "Detail" },
        ],
        events.map((e) => ({
          timestamp: formatTimestamp(e.timestamp),
          action: e.action,
          user: e.userName || e.userId || "—",
          org: e.orgId || "—",
          feature: e.feature || "—",
          status: e.status,
          detail: e.metaJson?.slug || e.metaJson?.sessionId?.slice?.(0, 8) || e.errorCode || "—",
        }))
      )}
    </div>`;
  };

  const renderDangerousActions = async () => {
    const { events, count } = await fetchDangerousActions();
    return `<div class="admin-panel"><h2>Dangerous Actions (24h)</h2><p class="muted">${count} high-risk actions in the last 24 hours.</p>
      ${renderSimpleTable(
        [
          { key: "timestamp", label: "Time" },
          { key: "action", label: "Action" },
          { key: "user", label: "User" },
          { key: "org", label: "Org" },
          { key: "items", label: "Items" },
        ],
        events.map((e) => ({
          timestamp: formatTimestamp(e.timestamp),
          action: e.action,
          user: e.userName || e.userId || "—",
          org: e.orgId || "—",
          items: String(e.itemCount ?? 0),
        }))
      )}</div>`;
  };

  const renderEndpointRegistry = async () => {
    const { endpoints } = await fetchMockApiEndpoints();
    return `<div class="admin-panel"><h2>API Endpoint Registry</h2>
      <p class="muted">Manage mock API endpoints across all connected users.</p>
      ${renderSimpleTable(
        [
          { key: "status", label: "Status" },
          { key: "method", label: "Method" },
          { key: "slug", label: "Slug" },
          { key: "owner", label: "Owner" },
          { key: "org", label: "Org" },
          { key: "calls24h", label: "Calls (24h)" },
          { key: "bytes24h", label: "Resp bytes (24h)" },
          { key: "actions", label: "Actions", allowHtml: true },
        ],
        endpoints.map((ep) => ({
          status: ep.status,
          method: ep.method,
          slug: ep.endpointSlug,
          owner: ep.ownerUserpart,
          org: ep.ownerOrgName || ep.ownerOrgId || "—",
          calls24h: String(ep.stats24h?.calls24h ?? 0),
          bytes24h: formatBytes(ep.stats24h?.responseBytes24h),
          actions:
            ep.status === "archived"
              ? `${renderActionButton("Activate", "activate-endpoint", `data-endpoint-id="${escapeHtml(ep.id)}"`)}${renderActionButton("Delete", "delete-endpoint", `data-endpoint-id="${escapeHtml(ep.id)}"`, true)}`
              : `${renderActionButton("Pause", "pause-endpoint", `data-endpoint-id="${escapeHtml(ep.id)}"`)}${renderActionButton("Delete", "delete-endpoint", `data-endpoint-id="${escapeHtml(ep.id)}"`, true)}`,
        })),
        {
          renderCell: (column, row) =>
            column.key === "actions" ? row.actions : escapeHtml(row[column.key] ?? ""),
        }
      )}
    </div>`;
  };

  const renderServerHealth = async () => {
    const offset = featureState.coreApi.page * PAGE_SIZE;
    const [compliance, coreApi, jobs, backups] = await Promise.all([
      fetchCompliance(),
      fetchCoreApi("24h", { limit: PAGE_SIZE, offset }),
      fetchJobs(),
      fetchBackups(),
    ]);
    const lastBackup = backups.runs?.[0];
    return `<div class="admin-panel"><h2>Server Health</h2>
      <section class="admin-section"><h3>Compliance</h3>
        ${renderSimpleTable(
          [{ key: "check", label: "Check" }, { key: "ok", label: "Status" }],
          (compliance.checks || []).map((c) => ({ check: c.name, ok: c.ok ? "OK" : "FAIL" }))
        )}
      </section>
      <section class="admin-section"><h3>Core API Metrics (24h)</h3>
        <p class="muted">Aggregated by API route (IDs normalized).</p>
        ${renderPagination(featureState.coreApi.page, PAGE_SIZE, coreApi.total || 0, "core-api")}
        ${renderSimpleTable(
          [
            { key: "route", label: "API Route" },
            { key: "calls", label: "Calls" },
            { key: "errors", label: "Errors" },
            { key: "avgMs", label: "Avg ms" },
            { key: "maxMs", label: "Max ms" },
          ],
          (coreApi.stats || []).map((s) => ({
            route: s.routeFamily,
            calls: String(s.callCount),
            errors: String(s.errorCount),
            avgMs: String(s.avgResponseTimeMs),
            maxMs: String(s.maxResponseTimeMs),
          }))
        )}
      </section>
      <section class="admin-section"><h3>Background Jobs</h3>
        ${renderSimpleTable(
          [
            { key: "job", label: "Job" },
            { key: "status", label: "Last status" },
            { key: "started", label: "Last run" },
            { key: "duration", label: "Duration" },
          ],
          (jobs.jobs || []).map((j) => ({
            job: j.jobName,
            status: j.last?.status || "never",
            started: formatTimestamp(j.last?.startedAt),
            duration: j.last?.durationMs != null ? `${j.last.durationMs}ms` : "—",
          }))
        )}
      </section>
      <section class="admin-section"><h3>Backups</h3>
        <p>Last backup: ${lastBackup ? `${lastBackup.status} at ${formatTimestamp(lastBackup.startedAt)} (${formatBytes(lastBackup.totalBytes)})` : "none"}</p>
        <button type="button" class="admin-action" data-admin-action="run-backup">Run backup now</button>
      </section>
    </div>`;
  };

  const renderLaunchMonitor = async () => {
    const { funnel, recentFailures } = await fetchLaunchFunnel();
    const rows = Object.entries(funnel || {}).map(([action, stats]) => ({
      action,
      total: String(stats.total),
      success: String(stats.success),
      failure: String(stats.failure),
    }));
    return `<div class="admin-panel"><h2>Launch Monitor</h2>
      ${renderSimpleTable(
        [
          { key: "action", label: "Step" },
          { key: "total", label: "Total" },
          { key: "success", label: "Success" },
          { key: "failure", label: "Failure" },
        ],
        rows
      )}
      <h3>Recent failures</h3>
      ${renderSimpleTable(
        [
          { key: "timestamp", label: "Time" },
          { key: "action", label: "Action" },
          { key: "error", label: "Error" },
        ],
        (recentFailures || []).map((e) => ({
          timestamp: formatTimestamp(e.timestamp),
          action: e.action,
          error: e.errorCode || e.status,
        }))
      )}
    </div>`;
  };

  const renderSessionsVault = async () => {
    const { credentials, vault } = await fetchSessions();
    return `<div class="admin-panel"><h2>Sessions & Vault</h2>
      <p class="muted">Expired sessions are purged automatically. Only active entries are shown.</p>
      <h3>Active session credentials</h3>
      ${renderSimpleTable(
        [
          { key: "user", label: "User" },
          { key: "org", label: "Org" },
          { key: "region", label: "Region" },
          { key: "expires", label: "Expires" },
          { key: "actions", label: "Actions", allowHtml: true },
        ],
        (credentials || []).map((c) => ({
          user: c.userDisplayName || c.userName || c.userId,
          org: c.orgName || c.orgId,
          region: c.region,
          expires: formatTimestamp(c.expiresAt),
          actions: renderActionButton("Remove", "revoke-session", `data-session-id="${escapeHtml(c.sessionId)}"`, true),
        })),
        {
          renderCell: (column, row) =>
            column.key === "actions" ? row.actions : escapeHtml(row[column.key] ?? ""),
        }
      )}
      <h3>Credential vault links</h3>
      ${renderSimpleTable(
        [
          { key: "user", label: "User" },
          { key: "org", label: "Org" },
          { key: "expires", label: "Expires" },
          { key: "actions", label: "Actions", allowHtml: true },
        ],
        (vault || []).map((v) => ({
          user: v.userDisplayName || v.userName || v.userId,
          org: v.orgName || v.orgId,
          expires: formatTimestamp(v.expiresAt),
          actions: renderActionButton("Revoke", "revoke-vault", `data-link-id="${escapeHtml(v.linkId)}"`, true),
        })),
        {
          renderCell: (column, row) =>
            column.key === "actions" ? row.actions : escapeHtml(row[column.key] ?? ""),
        }
      )}
    </div>`;
  };

  const renderUsageAnalytics = async () => {
    const usage = await fetchUsage("7d");
    const actionRows = Object.entries(usage.byAction || {})
      .sort((a, b) => b[1] - a[1])
      .map(([action, count]) => ({ action, count: String(count) }));
    const featureRows = Object.entries(usage.byFeature || {})
      .sort((a, b) => b[1] - a[1])
      .map(([feature, count]) => ({ feature, count: String(count) }));
    return `<div class="admin-panel"><h2>Usage Analytics (7d)</h2>
      <p class="muted">${usage.totalEvents} total events</p>
      <h3>By action</h3>${renderSimpleTable([{ key: "action", label: "Action" }, { key: "count", label: "Count" }], actionRows)}
      <h3>By feature</h3>${renderSimpleTable([{ key: "feature", label: "Feature" }, { key: "count", label: "Count" }], featureRows)}
    </div>`;
  };

  const renderStorageDetail = async () => {
    const storage = await fetchStorage("30d");
    return `<div class="admin-panel"><h2>Storage Detail</h2>
      ${renderStatGrid([
        { label: "session.db", value: formatBytes(storage.current?.sessionDbBytes) },
        { label: "mock-api.db", value: formatBytes(storage.current?.mockApiDbBytes) },
        { label: "logs.db", value: formatBytes(storage.current?.logsDbBytes) },
        { label: "admin.db", value: formatBytes(storage.current?.adminDbBytes) },
      ])}
      <p class="muted">${(storage.snapshots || []).length} historical snapshots (30d).</p>
      <button type="button" class="admin-action" data-admin-action="run-snapshots">Capture snapshot now</button>
    </div>`;
  };

  const renderActivityTimeline = async () => {
    const { activities } = await fetchActivity();
    return `<div class="admin-panel"><h2>Activity Timeline</h2>
      ${renderSimpleTable(
        [
          { key: "timestamp", label: "Time" },
          { key: "action", label: "Action" },
          { key: "org", label: "Org" },
          { key: "status", label: "Status" },
        ],
        (activities || []).map((a) => ({
          timestamp: formatTimestamp(a.timestamp),
          action: a.action,
          org: a.orgId || "—",
          status: `${a.successCount}/${a.affectedCount} ok`,
        }))
      )}
    </div>`;
  };

  const panels = {
    "genesys-admin-operations": () => showPanel("Operations Dashboard", () => renderOperationsDashboard(), "genesys-admin-operations"),
    "genesys-admin-audit-log": () => showPanel("PS Tool Audit Log", renderAuditLog, "genesys-admin-audit-log"),
    "genesys-admin-activity": () => showPanel("Activity Timeline", renderActivityTimeline, "genesys-admin-activity"),
    "genesys-admin-dangerous": () => showPanel("Dangerous Actions", renderDangerousActions, "genesys-admin-dangerous"),
    "genesys-admin-endpoint-registry": () => showPanel("API Endpoint Registry", renderEndpointRegistry, "genesys-admin-endpoint-registry"),
    "genesys-admin-server-health": () => showPanel("Server Health", renderServerHealth, "genesys-admin-server-health"),
    "genesys-admin-launch-monitor": () => showPanel("Launch Monitor", renderLaunchMonitor, "genesys-admin-launch-monitor"),
    "genesys-admin-sessions": () => showPanel("Sessions & Vault", renderSessionsVault, "genesys-admin-sessions"),
    "genesys-admin-usage": () => showPanel("Usage Analytics", renderUsageAnalytics, "genesys-admin-usage"),
    "genesys-admin-storage": () => showPanel("Storage Detail", renderStorageDetail, "genesys-admin-storage"),
  };

  const initButtons = () => {
    Object.entries(panels).forEach(([id, handler]) => {
      wireButton(document.getElementById(id), handler);
    });
  };

  return {
    initButtons,
    handleClick,
    wireButton,
    panels,
  };
};

export { createAdminFeatures };
