import { isWebRtcPhone } from "../bulk-phone-utils.js";
import { renderGuxDropdown } from "../gux-ui.js";
import { escapeHtml, formatCacheAge, formatTimestamp, renderCacheStatus } from "./cache-utils.js";
import { createDashboardWidget } from "./widget-host.js";
import {
  getInventoryData,
  getInventoryMeta,
  INVENTORY_RESOURCES,
  loadInventoryEntry,
} from "./inventory-store.js";
import { getAllResourceCacheMeta, getResourceCacheMeta } from "../resource-cache.js";
import { getSessionActivities } from "./session-activity.js";

const ALL_LIMITS_NAMESPACE = "__all__";

const formatLimitValue = (value) => {
  if (value == null || value === "") {
    return "—";
  }

  if (Number(value) === -1) {
    return "Unlimited";
  }

  return String(value);
};

const parseOrganizationLimits = (limitsPayload) => {
  const payload =
    limitsPayload && Array.isArray(limitsPayload.namespaces)
      ? limitsPayload
      : limitsPayload?.limits && Array.isArray(limitsPayload.limits.namespaces)
        ? limitsPayload.limits
        : null;

  if (!payload) {
    return { namespaces: [], rows: [] };
  }

  const namespaces = (payload.namespaces || [])
    .map((namespace) => ({
      name: String(namespace.name || ""),
      friendlyName: String(namespace.friendlyName || namespace.name || "Unknown"),
      limitCount: Array.isArray(namespace.limits) ? namespace.limits.length : 0,
    }))
    .filter((namespace) => namespace.name)
    .sort((left, right) => left.friendlyName.localeCompare(right.friendlyName));

  const rows = [];

  (payload.namespaces || []).forEach((namespace) => {
    const namespaceName = String(namespace.name || "");
    const friendlyName = String(namespace.friendlyName || namespace.name || "Unknown");

    (namespace.limits || []).forEach((limit) => {
      if (!limit?.key) {
        return;
      }

      rows.push({
        namespaceName,
        friendlyName,
        key: String(limit.key),
        description: String(limit.description || ""),
        defaultValue: limit.defaultValue,
        configuredValue: limit.configuredValue,
      });
    });
  });

  rows.sort((left, right) => {
    const namespaceCompare = left.friendlyName.localeCompare(right.friendlyName);
    if (namespaceCompare !== 0) {
      return namespaceCompare;
    }

    return left.key.localeCompare(right.key);
  });

  return { namespaces, rows };
};

const filterLimitRows = (rows, selectedNamespace) => {
  if (!selectedNamespace || selectedNamespace === ALL_LIMITS_NAMESPACE) {
    return rows;
  }

  return rows.filter((row) => row.namespaceName === selectedNamespace);
};

const flattenMetrics = (metrics) => {
  if (!metrics || typeof metrics !== "object") {
    return [];
  }

  const rows = [];
  const visit = (node, prefix = "") => {
    if (node == null) {
      return;
    }

    if (typeof node !== "object") {
      rows.push({ label: prefix, value: String(node) });
      return;
    }

    if (Array.isArray(node)) {
      rows.push({ label: prefix, value: String(node.length) });
      return;
    }

    Object.entries(node).forEach(([key, value]) => {
      const label = prefix ? `${prefix}.${key}` : key;
      if (value != null && typeof value !== "object") {
        rows.push({ label, value: String(value) });
        return;
      }

      if (value && typeof value === "object" && !Array.isArray(value)) {
        const childKeys = Object.keys(value);
        if (childKeys.length <= 4 && childKeys.some((entry) => typeof value[entry] !== "object")) {
          visit(value, label);
        } else {
          rows.push({ label, value: JSON.stringify(value) });
        }
      }
    });
  };

  visit(metrics);
  return rows.slice(0, 12);
};

const computeHealthChecks = ({ users, phones, queues, queueMembersById }) => {
  const checks = [];

  if (Array.isArray(users)) {
    const usersWithoutRoles = users.filter(
      (user) => !Array.isArray(user.authorization?.roles) || user.authorization.roles.length === 0
    ).length;
    const usersWithoutSkills = users.filter(
      (user) => !Array.isArray(user.skills) || user.skills.length === 0
    ).length;

    checks.push({
      id: "users-without-roles",
      issue: "Users without Roles",
      count: usersWithoutRoles,
      exportNavId: "genesys-users",
      dependsOn: ["users"],
    });
    checks.push({
      id: "users-without-skills",
      issue: "Users without Skills",
      count: usersWithoutSkills,
      exportNavId: "genesys-user-skills",
      dependsOn: ["users"],
    });

    if (Array.isArray(phones)) {
      const phoneUserIds = new Set(
        phones.map((phone) => phone?.webRtcUser?.id).filter(Boolean)
      );
      const usersWithoutPhones = users.filter((user) => !phoneUserIds.has(user.id)).length;
      checks.push({
        id: "users-without-phones",
        issue: "Users without Phones",
        count: usersWithoutPhones,
        exportNavId: "genesys-users",
        dependsOn: ["users", "phones"],
      });
    }
  }

  if (Array.isArray(phones)) {
    const webrtcWithoutUser = phones.filter(
      (phone) => isWebRtcPhone(phone) && !phone?.webRtcUser?.id
    ).length;
    checks.push({
      id: "webrtc-without-user",
      issue: "WebRTC Phones with no corresponding User",
      count: webrtcWithoutUser,
      exportNavId: "genesys-phones",
      dependsOn: ["phones"],
    });
  }

  if (Array.isArray(queues) && queueMembersById) {
    const emptyQueues = queues.filter((queue) => (queueMembersById[queue.id] || []).length === 0).length;
    checks.push({
      id: "queues-without-members",
      issue: "Queues with no Members",
      count: emptyQueues,
      exportNavId: "genesys-queue-members",
      dependsOn: ["queues", "queueMembers"],
    });
  }

  return checks;
};

const renderInventoryRow = ({ label, count, status, cachedAt, exportNavId, resourceKey, widgetId }) => {
  const countLabel = count == null ? "Not Loaded" : String(count);
  return `<div class="dashboard-row">
    <div class="dashboard-row__primary">
      <div class="dashboard-row__title">${escapeHtml(label)}</div>
      <div class="dashboard-row__value">${escapeHtml(countLabel)}</div>
    </div>
    <div class="dashboard-row__meta">${renderCacheStatus({ status, cachedAt })}</div>
    <div class="dashboard-row__actions">
      ${
        status === "Not Loaded"
          ? `<gux-button type="button" accent="secondary" data-dashboard-action="load-resource" data-resource-key="${escapeHtml(
              resourceKey
            )}" data-widget-id="${escapeHtml(widgetId)}">Load</gux-button>`
          : `<gux-button type="button" accent="secondary" data-dashboard-action="refresh" data-widget-id="${escapeHtml(
              widgetId
            )}">Refresh</gux-button>`
      }
      <gux-button type="button" accent="ghost" data-dashboard-action="open-export" data-export-nav-id="${escapeHtml(
        exportNavId
      )}">Open Export</gux-button>
    </div>
  </div>`;
};

const createOrganizationSnapshotWidget = (deps) =>
  createDashboardWidget({
    id: "organization-snapshot",
    title: "Organization Snapshot",
    className: "dashboard-widget--snapshot",
    load: async ({ setState }) => {
      const credentials = deps.requireCredentials("Dashboard");
      if (!credentials) {
        throw new Error("Connection required");
      }

      const [userStatus, currentUser, sessionStatus] = await Promise.all([
        deps.fetchUserSyncStatus().catch(() => ({ sync: {} })),
        deps.getCurrentUser(credentials).catch(() => null),
        deps.fetchSessionStatus().catch(() => ({ connection: null })),
      ]);

      setState({
        status: "ready",
        snapshot: {
          organizationName: deps.getOrganizationName(),
          organizationId: deps.getOrganizationId(),
          region: deps.getRegion(),
          connectedUser: currentUser?.name || currentUser?.username || currentUser?.id || "",
          connectedAt:
            sessionStatus?.connection?.connectedAt || deps.getConnectedAt() || Date.now(),
          userCache: userStatus?.sync || {},
          resourceCaches: getAllResourceCacheMeta(),
        },
      });
    },
    refresh: async ({ setState }) => {
      const credentials = deps.requireCredentials("Dashboard");
      if (!credentials) {
        throw new Error("Connection required");
      }

      const [userStatus, currentUser, sessionStatus] = await Promise.all([
        deps.fetchUserSyncStatus().catch(() => ({ sync: {} })),
        deps.getCurrentUser(credentials).catch(() => null),
        deps.fetchSessionStatus().catch(() => ({ connection: null })),
      ]);

      setState({
        status: "ready",
        snapshot: {
          organizationName: deps.getOrganizationName(),
          organizationId: deps.getOrganizationId(),
          region: deps.getRegion(),
          connectedUser: currentUser?.name || currentUser?.username || currentUser?.id || "",
          connectedAt:
            sessionStatus?.connection?.connectedAt || deps.getConnectedAt() || Date.now(),
          userCache: userStatus?.sync || {},
          resourceCaches: getAllResourceCacheMeta(),
        },
      });
    },
    renderContent: (state) => {
      const snapshot = state.snapshot;
      if (!snapshot) {
        return '<p class="muted">Loading organization snapshot...</p>';
      }

      const cacheRows = [
        ["User Cache", snapshot.userCache?.syncedAt, snapshot.userCache?.status === "ready"],
        ["Roles Cache", snapshot.resourceCaches?.roles?.cachedAt, snapshot.resourceCaches?.roles?.loaded],
        ["Queues Cache", snapshot.resourceCaches?.queues?.cachedAt, snapshot.resourceCaches?.queues?.loaded],
        ["Skills Cache", snapshot.resourceCaches?.skills?.cachedAt, snapshot.resourceCaches?.skills?.loaded],
        ["Groups Cache", snapshot.resourceCaches?.groups?.cachedAt, snapshot.resourceCaches?.groups?.loaded],
        ["Phone Cache", snapshot.resourceCaches?.phones?.cachedAt, snapshot.resourceCaches?.phones?.loaded],
        ["Site Cache", snapshot.resourceCaches?.sites?.cachedAt, snapshot.resourceCaches?.sites?.loaded],
        ["Division Cache", snapshot.resourceCaches?.divisions?.cachedAt, snapshot.resourceCaches?.divisions?.loaded],
        ["Data Table Cache", snapshot.resourceCaches?.dataTables?.cachedAt, snapshot.resourceCaches?.dataTables?.loaded],
      ]
        .map(
          ([label, cachedAt, loaded]) =>
            `<div class="dashboard-kv"><span>${escapeHtml(label)}</span><span class="muted">${
              loaded ? escapeHtml(formatCacheAge(cachedAt)) : "Not Loaded"
            }</span></div>`
        )
        .join("");

      return `<div class="dashboard-kv-grid">
        <div class="dashboard-kv"><span>Organization</span><strong>${escapeHtml(snapshot.organizationName || "")}</strong></div>
        <div class="dashboard-kv"><span>Organization ID</span><code>${escapeHtml(snapshot.organizationId || "")}</code></div>
        <div class="dashboard-kv"><span>Region</span><span>${escapeHtml(snapshot.region || "")}</span></div>
        <div class="dashboard-kv"><span>Connected User</span><span>${escapeHtml(snapshot.connectedUser || "")}</span></div>
        <div class="dashboard-kv"><span>Connection Time</span><span>${escapeHtml(formatTimestamp(snapshot.connectedAt))}</span></div>
      </div>
      <div class="dashboard-subsection">
        <h4>Cache Ages</h4>
        ${cacheRows}
      </div>`;
    },
  });

const createInventoryWidget = (deps) => {
  const widgetId = "inventory";

  const buildInventoryState = async () => {
    const userStatus = await deps.fetchUserSyncStatus().catch(() => ({ sync: {} }));
    const resourceMeta = getAllResourceCacheMeta();

    const rows = [
      {
        key: "users",
        label: "Users",
        exportNavId: "genesys-users",
        count: userStatus?.sync?.status === "ready" ? userStatus.sync.userCount : null,
        status: userStatus?.sync?.status === "ready" ? "Cached" : "Not Loaded",
        cachedAt: userStatus?.sync?.syncedAt || null,
      },
      ...INVENTORY_RESOURCES.map((resource) => {
        const meta = getInventoryMeta(resource.key);
        return {
          key: resource.key,
          label: resource.label,
          exportNavId: resource.exportNavId,
          count: meta.loaded ? meta.count : null,
          status: meta.loaded ? "Cached" : "Not Loaded",
          cachedAt: meta.cachedAt,
        };
      }),
      {
        key: "phones",
        label: "Phones",
        exportNavId: "genesys-phones",
        count: resourceMeta.phones.loaded ? resourceMeta.phones.count : null,
        status: resourceMeta.phones.loaded ? "Cached" : "Not Loaded",
        cachedAt: resourceMeta.phones.cachedAt,
      },
      {
        key: "dataTables",
        label: "Data Tables",
        exportNavId: "genesys-datatable-export",
        count: resourceMeta.dataTables.loaded ? resourceMeta.dataTables.count : null,
        status: resourceMeta.dataTables.loaded ? "Cached" : "Not Loaded",
        cachedAt: resourceMeta.dataTables.cachedAt,
      },
    ];

    return rows;
  };

  return createDashboardWidget({
    id: widgetId,
    title: "Inventory",
    className: "dashboard-widget--inventory",
    load: async ({ setState }) => {
      setState({ status: "ready", rows: await buildInventoryState() });
    },
    refresh: async ({ setState }) => {
      setState({ status: "loading" });
      setState({ status: "ready", rows: await buildInventoryState() });
    },
    renderContent: (state) => {
      const rows = state.rows || [];
      return `<div class="dashboard-stack">${rows
        .map((row) =>
          renderInventoryRow({
            ...row,
            resourceKey: row.key,
            widgetId,
          })
        )
        .join("")}</div>`;
    },
  });
};

const createHealthChecksWidget = (deps) => {
  const widgetId = "health-checks";
  let queueMembersById = null;

  const resolveDependencies = async (credentials, { loadQueueMembers = false } = {}) => {
    const userStatus = await deps.fetchUserSyncStatus().catch(() => ({ sync: {} }));
    let users = null;
    if (userStatus?.sync?.status === "ready") {
      const payload = await deps.fetchCachedUsers().catch(() => ({ users: [] }));
      users = Array.isArray(payload?.users) ? payload.users : [];
    }

    const phones = deps.peekCachedPhones();
    const queues = getInventoryData("queues");

    if (loadQueueMembers && Array.isArray(queues) && !queueMembersById) {
      queueMembersById = {};
      await Promise.all(
        queues.map(async (queue) => {
          try {
            queueMembersById[queue.id] = await deps.getQueueMembers({ ...credentials, queueId: queue.id });
          } catch {
            queueMembersById[queue.id] = [];
          }
        })
      );
    }

    return { users, phones, queues, queueMembersById };
  };

  return createDashboardWidget({
    id: widgetId,
    title: "Health Checks",
    className: "dashboard-widget--health",
    load: async ({ setState }) => {
      const credentials = deps.requireCredentials("Dashboard");
      if (!credentials) {
        throw new Error("Connection required");
      }

      const { users, phones, queues, queueMembersById: members } = await resolveDependencies(credentials, {
        loadQueueMembers: Array.isArray(getInventoryData("queues")),
      });
      const checks = computeHealthChecks({ users, phones, queues, queueMembersById: members });
      setState({
        status: "ready",
        checks,
        usersLoaded: Array.isArray(users),
        phonesLoaded: Array.isArray(phones),
        queuesLoaded: Array.isArray(queues),
        queueMembersLoaded: Boolean(members),
      });
    },
    refresh: async ({ setState }) => {
      const credentials = deps.requireCredentials("Dashboard");
      if (!credentials) {
        throw new Error("Connection required");
      }

      const { users, phones, queues, queueMembersById: members } = await resolveDependencies(credentials, {
        loadQueueMembers: Array.isArray(getInventoryData("queues")),
      });
      const checks = computeHealthChecks({ users, phones, queues, queueMembersById: members });
      setState({
        status: "ready",
        checks,
        usersLoaded: Array.isArray(users),
        phonesLoaded: Array.isArray(phones),
        queuesLoaded: Array.isArray(queues),
        queueMembersLoaded: Boolean(members),
      });
    },
    renderContent: (state) => {
      const checks = state.checks || [];
      if (!checks.length) {
        return `<p class="muted">Load user, phone, or queue inventory to evaluate health checks.</p>
          <div class="dashboard-row__actions">
            <gux-button type="button" accent="secondary" data-dashboard-action="load-resource" data-resource-key="users" data-widget-id="${widgetId}">Load User Cache</gux-button>
            <gux-button type="button" accent="secondary" data-dashboard-action="load-resource" data-resource-key="phones" data-widget-id="${widgetId}">Load Phone Inventory</gux-button>
            <gux-button type="button" accent="secondary" data-dashboard-action="load-resource" data-resource-key="queues" data-widget-id="${widgetId}">Load Queue Inventory</gux-button>
          </div>`;
      }

      return `<div class="dashboard-stack">${checks
        .map((check) => {
          const missing = [];
          if (check.dependsOn.includes("users") && !state.usersLoaded) {
            missing.push("User Cache");
          }
          if (check.dependsOn.includes("phones") && !state.phonesLoaded) {
            missing.push("Phone Inventory");
          }
          if (check.dependsOn.includes("queues") && !state.queuesLoaded) {
            missing.push("Queue Inventory");
          }

          const status =
            missing.length > 0 ? `Requires ${missing.join(" + ")}` : check.count > 0 ? "Review" : "OK";

          return `<div class="dashboard-row">
            <div class="dashboard-row__primary">
              <div class="dashboard-row__title">${escapeHtml(check.issue)}</div>
              <div class="dashboard-row__value">${missing.length ? "—" : escapeHtml(String(check.count))}</div>
            </div>
            <div class="dashboard-row__meta"><span class="muted">${escapeHtml(status)}</span></div>
            <div class="dashboard-row__actions">
              ${
                missing.includes("User Cache")
                  ? `<gux-button type="button" accent="secondary" data-dashboard-action="load-resource" data-resource-key="users" data-widget-id="${widgetId}">Load User Cache</gux-button>`
                  : ""
              }
              ${
                missing.includes("Phone Inventory")
                  ? `<gux-button type="button" accent="secondary" data-dashboard-action="load-resource" data-resource-key="phones" data-widget-id="${widgetId}">Load Phone Inventory</gux-button>`
                  : ""
              }
              ${
                missing.includes("Queue Inventory")
                  ? `<gux-button type="button" accent="secondary" data-dashboard-action="load-resource" data-resource-key="queues" data-widget-id="${widgetId}">Load Queue Inventory</gux-button>`
                  : ""
              }
              <gux-button type="button" accent="ghost" data-dashboard-action="open-export" data-export-nav-id="${escapeHtml(
                check.exportNavId
              )}">Open Related Export</gux-button>
            </div>
          </div>`;
        })
        .join("")}</div>`;
    },
  });
};

const createOrganizationLimitsWidget = (deps) => {
  const widgetId = "organization-limits";
  let filterListenerAttached = false;

  const applyLimitsPayload = (limitsPayload, setState, selectedNamespace = ALL_LIMITS_NAMESPACE) => {
    const { namespaces, rows } = parseOrganizationLimits(limitsPayload);
    setState({
      status: "ready",
      namespaces,
      rows,
      selectedNamespace,
      cachedAt: Date.now(),
    });
  };

  return createDashboardWidget({
    id: widgetId,
    title: "Organization Limits",
    className: "dashboard-widget--limits dashboard-widget--full",
    initialize: async ({ setState, widgetRoot }) => {
      if (filterListenerAttached || !widgetRoot) {
        return;
      }

      widgetRoot.addEventListener("change", (event) => {
        const dropdown =
          event.target instanceof HTMLElement
            ? event.target.closest('[data-dashboard-filter="limits-namespace"]')
            : null;
        if (!dropdown || !widgetRoot.contains(dropdown)) {
          return;
        }

        const value =
          "value" in dropdown && dropdown.value != null ? String(dropdown.value) : ALL_LIMITS_NAMESPACE;
        setState({ selectedNamespace: value });
      });

      filterListenerAttached = true;
    },
    load: async ({ setState }) => {
      const credentials = deps.requireCredentials("Dashboard");
      if (!credentials) {
        throw new Error("Connection required");
      }

      const limitsPayload = await deps.getOrganizationLimits(credentials);
      applyLimitsPayload(limitsPayload, setState);
    },
    refresh: async ({ setState, getState }) => {
      const credentials = deps.requireCredentials("Dashboard");
      if (!credentials) {
        throw new Error("Connection required");
      }

      const limitsPayload = await deps.getOrganizationLimits(credentials);
      applyLimitsPayload(
        limitsPayload,
        setState,
        getState()?.selectedNamespace || ALL_LIMITS_NAMESPACE
      );
    },
    renderContent: (state) => {
      if (state.status === "error") {
        return `<p class="muted">${escapeHtml(state.error || "Failed to load organization limits.")}</p>`;
      }

      const rows = state.rows || [];
      if (!rows.length) {
        return `<p class="muted">No organization limit data returned.</p>
          <gux-button type="button" accent="secondary" data-dashboard-action="load" data-widget-id="${widgetId}">Load Limits</gux-button>`;
      }

      const selectedNamespace = state.selectedNamespace || ALL_LIMITS_NAMESPACE;
      const namespaceOptions = [
        { value: ALL_LIMITS_NAMESPACE, label: "All Namespaces" },
        ...(state.namespaces || []).map((namespace) => ({
          value: namespace.name,
          label: `${namespace.friendlyName} (${namespace.limitCount})`,
        })),
      ];
      const visibleRows = filterLimitRows(rows, selectedNamespace);

      return `<div class="dashboard-table-wrap">
        <div class="dashboard-limits-toolbar">
          ${renderGuxDropdown({
            escapeHtml,
            inputId: `${widgetId}-namespace-filter`,
            className: "dashboard-limits-filter",
            label: "Namespace",
            value: selectedNamespace,
            options: namespaceOptions,
            placeholder: "Filter by namespace",
            listboxLabel: "Organization limit namespaces",
            attrs: `data-dashboard-filter="limits-namespace" data-widget-id="${widgetId}"`,
          })}
          <div class="dashboard-row__meta">${renderCacheStatus({ status: "Cached", cachedAt: state.cachedAt })}</div>
        </div>
        <p class="muted dashboard-limits-summary">${escapeHtml(String(visibleRows.length))} limit${visibleRows.length === 1 ? "" : "s"} shown</p>
        <table class="dashboard-table dashboard-table--limits">
          <thead><tr><th>Key</th><th>Description</th><th>Default Value</th><th>Configured Value</th></tr></thead>
          <tbody>${visibleRows
            .map(
              (row) =>
                `<tr>
                  <td><code>${escapeHtml(row.key)}</code></td>
                  <td>${escapeHtml(row.description || "—")}</td>
                  <td>${escapeHtml(formatLimitValue(row.defaultValue))}</td>
                  <td>${escapeHtml(formatLimitValue(row.configuredValue))}</td>
                </tr>`
            )
            .join("")}</tbody>
        </table>
        <gux-button type="button" accent="secondary" data-dashboard-action="refresh" data-widget-id="${widgetId}">Refresh</gux-button>
      </div>`;
    },
  });
};

const createTelephonyMetricsWidget = (deps) => {
  const widgetId = "telephony-metrics";

  return createDashboardWidget({
    id: widgetId,
    title: "Telephony Metrics",
    className: "dashboard-widget--telephony",
    load: async ({ setState }) => {
      const credentials = deps.requireCredentials("Dashboard");
      if (!credentials) {
        throw new Error("Connection required");
      }

      const metrics = await deps.getTelephonyCallMetrics(credentials);
      setState({
        status: "ready",
        metrics: flattenMetrics(metrics),
        liveUpdatedAt: Date.now(),
      });
    },
    refresh: async ({ setState }) => {
      setState({ status: "loading" });
      const credentials = deps.requireCredentials("Dashboard");
      if (!credentials) {
        throw new Error("Connection required");
      }

      const metrics = await deps.getTelephonyCallMetrics(credentials);
      setState({
        status: "ready",
        metrics: flattenMetrics(metrics),
        liveUpdatedAt: Date.now(),
      });
    },
    renderContent: (state) => {
      const metrics = state.metrics || [];
      return `<div class="dashboard-kv-grid">
        ${metrics
          .map(
            (metric) =>
              `<div class="dashboard-kv"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></div>`
          )
          .join("")}
      </div>
      <div class="dashboard-row__meta">${renderCacheStatus({ status: "Live", liveUpdatedAt: state.liveUpdatedAt })}</div>
      <gux-button type="button" accent="secondary" data-dashboard-action="refresh" data-widget-id="${widgetId}">Refresh</gux-button>`;
    },
  });
};

const createSessionActivityWidget = () =>
  createDashboardWidget({
    id: "session-activity",
    title: "Session Activity",
    className: "dashboard-widget--activity dashboard-widget--full",
    load: async ({ setState }) => {
      let activities = getSessionActivities();
      try {
        const response = await fetch("/api/admin/activity", { credentials: "same-origin" });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.activities) && data.activities.length) {
            activities = data.activities;
          }
        }
      } catch (_error) {
        // use local fallback
      }
      setState({ status: "ready", activities });
    },
    refresh: async ({ setState }) => {
      let activities = getSessionActivities();
      try {
        const response = await fetch("/api/admin/activity", { credentials: "same-origin" });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.activities)) {
            activities = data.activities;
          }
        }
      } catch (_error) {
        // use local fallback
      }
      setState({ status: "ready", activities });
    },
    renderContent: (state) => {
      const activities = state.activities || [];
      if (!activities.length) {
        return '<p class="muted">No bulk actions or workflows have been run in this session yet.</p>';
      }

      return `<div class="dashboard-table-wrap"><table class="dashboard-table">
        <thead><tr><th>Timestamp</th><th>Action</th><th>Affected</th><th>Success</th><th>Failure</th></tr></thead>
        <tbody>${activities
          .map(
            (entry) =>
              `<tr>
                <td>${escapeHtml(formatTimestamp(entry.timestamp))}</td>
                <td>${escapeHtml(entry.action)}</td>
                <td>${escapeHtml(String(entry.affectedCount))}</td>
                <td>${escapeHtml(String(entry.successCount))}</td>
                <td>${escapeHtml(String(entry.failureCount))}</td>
              </tr>`
          )
          .join("")}</tbody>
      </table></div>`;
    },
  });

const createDashboardWidgets = (deps) => [
  createOrganizationSnapshotWidget(deps),
  createInventoryWidget(deps),
  createHealthChecksWidget(deps),
  createOrganizationLimitsWidget(deps),
  createTelephonyMetricsWidget(deps),
  createSessionActivityWidget(),
];

export { createDashboardWidgets, computeHealthChecks, parseOrganizationLimits, filterLimitRows };
