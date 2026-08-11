import { downloadFlowExecutionModel, fetchFlowExecutions } from "./flow-execution-client.js";
import {
  buildExpandedTrackingIds,
  filterVariableNames,
  findErrorTargets,
  findSearchMatches,
  getFinalVariableStates,
  getTrackedVariableDisplay,
  getVariableHistoryEntries,
  nodeMatchesSearch,
} from "./flow-execution-analysis.js";
import { renderGuxTable } from "./gux-ui.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatTimestamp = (value) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
};

const formatClock = (value) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
    `.${String(date.getMilliseconds()).padStart(3, "0")}`;
};

const formatDuration = (durationMs) => {
  const ms = Number(durationMs) || 0;
  if (ms < 1000) {
    return `${ms} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
};

const renderJsonBlock = (value) =>
  `<pre class="flow-exec-json">${escapeHtml(typeof value === "string" ? value : JSON.stringify(value, null, 2))}</pre>`;

const normalizeExecutionRow = (execution) => {
  const startDateTime = execution?.startDateTime || execution?.startTime || "";
  const endDateTime = execution?.endDateTime || execution?.endTime || "";
  const startMs = Date.parse(startDateTime);
  const endMs = Date.parse(endDateTime);
  const durationMs = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs ? endMs - startMs : 0;

  return {
    id: execution?.id || "",
    flowName: execution?.flowName || execution?.name || execution?.id || "",
    flowType: execution?.flowType || execution?.type || "",
    flowVersion: execution?.flowVersion || execution?.version || "",
    startDateTime,
    endDateTime,
    durationMs,
    durationLabel: formatDuration(durationMs),
    flowErrorReason: execution?.flowErrorReason || execution?.errorReason || "",
    flowWarningReason: execution?.flowWarningReason || execution?.warningReason || "",
    raw: execution,
  };
};

const defaultViewerState = () => ({
  phase: "selection",
  conversationId: "",
  executions: [],
  selectedExecution: null,
  model: null,
  expandedTrackingIds: {},
  searchQuery: "",
  searchMatchIndex: 0,
  trackedVariables: [],
  variableTrackMode: "tracked",
  variablePickerQuery: "",
  focusTrackingId: null,
  highlightTrackingId: null,
  showVariablePanel: false,
});

const createFlowExecutionFeature = ({
  state,
  requireCredentials,
  getCurrentAppDomain,
  startExportResult,
  finishExportResult,
  renderLoadingState,
  renderJsonBlock: renderJsonBlockFn = renderJsonBlock,
  confirmModal,
}) => {
  let featureState = defaultViewerState();

  const getCredentials = () => requireCredentials("Flow Execution");

  const getExportMeta = (resultId) => state.exportData[resultId] || null;

  const setExportMeta = (resultId, exportMeta) => {
    state.exportData[resultId] = exportMeta;
  };

  const updateResultChrome = (resultId, { title, status } = {}) => {
    const resultEl = document.getElementById(resultId);
    if (!resultEl) {
      return;
    }

    if (title) {
      const titleEl = resultEl.querySelector(".export-results__title");
      if (titleEl) {
        titleEl.textContent = title;
      }
    }

    if (status) {
      const statusEl =
        resultEl.querySelector(".export-results__status") || resultEl.querySelector(".export-results__summary > .muted");
      if (statusEl) {
        statusEl.textContent = status;
      }
    }
  };

  const updateResultBody = (resultId, html) => {
    const resultEl = document.getElementById(resultId);
    const bodyEl = resultEl?.querySelector(".export-results__body");
    if (bodyEl) {
      bodyEl.innerHTML = html;
    }
  };

  const buildTimelineExportMeta = (resultId, status) => ({
    ...getExportMeta(resultId),
    title: "Architect Execution Timeline",
    status,
    statusBase: status,
    exportType: "flow_execution_timeline",
    hideActions: true,
    editable: false,
    renderBody: () => renderFeatureBody(resultId),
  });

  const isExpanded = (trackingId) => Boolean(featureState.expandedTrackingIds[trackingId]);

  const setExpanded = (trackingId, expanded) => {
    featureState.expandedTrackingIds[trackingId] = expanded;
  };

  const getSearchMatches = () => findSearchMatches(featureState.model, featureState.searchQuery);

  const getErrorTargets = () => findErrorTargets(featureState.model);

  const renderSelectionTable = (resultId) => {
    const columns = [
      { key: "flowName", header: "Flow Name" },
      { key: "flowType", header: "Flow Type" },
      { key: "flowVersion", header: "Flow Version" },
      { key: "startDateTime", header: "Start Time" },
      { key: "endDateTime", header: "End Time" },
      { key: "durationLabel", header: "Duration" },
      { key: "flowErrorReason", header: "Error Status" },
      { key: "flowWarningReason", header: "Warning Status" },
      { key: "actions", header: "Actions" },
    ];

    return renderGuxTable({
      columns,
      rows: featureState.executions,
      escapeHtml,
      className: "flow-exec-selection-table",
      emptyMessage: "No flow executions found for this conversation.",
      renderCell: (column, row) => {
        if (column.key === "startDateTime" || column.key === "endDateTime") {
          return escapeHtml(formatTimestamp(row[column.key]));
        }
        if (column.key === "flowErrorReason") {
          return row.flowErrorReason
            ? `<span class="flow-exec-badge flow-exec-badge--error">${escapeHtml(row.flowErrorReason)}</span>`
            : `<span class="muted">None</span>`;
        }
        if (column.key === "flowWarningReason") {
          return row.flowWarningReason
            ? `<span class="flow-exec-badge flow-exec-badge--warning">${escapeHtml(row.flowWarningReason)}</span>`
            : `<span class="muted">None</span>`;
        }
        if (column.key === "actions") {
          const appDomain = getCurrentAppDomain();
          const genesysUrl = appDomain
            ? `https://apps.${escapeHtml(appDomain)}/architect/#/flowInstance/${escapeHtml(row.id)}`
            : "";
          return `<div class="flow-exec-row-actions">
            ${
              genesysUrl
                ? `<a class="flow-exec-action" href="${genesysUrl}" target="_blank" rel="noreferrer noopener">Open in Genesys</a>`
                : `<span class="muted">Connect for Genesys link</span>`
            }
            <button type="button" class="flow-exec-action flow-exec-action--primary" data-flow-exec-action="open-ps-tool" data-result-id="${escapeHtml(resultId)}" data-instance-id="${escapeHtml(row.id)}">Open in PS Tool</button>
          </div>`;
        }
        return escapeHtml(row[column.key] ?? "");
      },
    });
  };

  const renderSummary = () => {
    const summary = featureState.model?.summary || {};
    const errors = getErrorTargets();

    return `<section class="flow-exec-summary">
      <div class="flow-exec-summary__grid">
        <div><span>Conversation ID</span><strong>${escapeHtml(summary.conversationId || featureState.conversationId)}</strong></div>
        <div><span>Execution ID</span><strong>${escapeHtml(summary.executionId || featureState.selectedExecution?.id || "")}</strong></div>
        <div><span>Flow Name</span><strong>${escapeHtml(summary.flowName || "")}</strong></div>
        <div><span>Flow Type</span><strong>${escapeHtml(summary.flowType || "")}</strong></div>
        <div><span>Flow Version</span><strong>${escapeHtml(summary.flowVersion || "")}</strong></div>
        <div><span>Start Time</span><strong>${escapeHtml(formatTimestamp(summary.startTime))}</strong></div>
        <div><span>End Time</span><strong>${escapeHtml(formatTimestamp(summary.endTime))}</strong></div>
        <div><span>Execution Time</span><strong>${escapeHtml(formatDuration(summary.executionTimeMs))}</strong></div>
        <div><span>Actions Executed</span><strong>${escapeHtml(summary.actionsExecuted ?? 0)}</strong></div>
        <div><span>Errors</span><strong>${escapeHtml(summary.errors ?? 0)}</strong></div>
        <div><span>Warnings</span><strong>${escapeHtml(summary.warnings ?? 0)}</strong></div>
        <div><span>Flow Exit Reason</span><strong>${escapeHtml(summary.flowExitReason || "—")}</strong></div>
      </div>
      <div class="flow-exec-summary__actions">
        <button type="button" class="flow-exec-action" data-flow-exec-action="back-selection">Back to Flow Selection</button>
        ${
          errors.length
            ? `<button type="button" class="flow-exec-action" data-flow-exec-action="goto-first-error">Go To First Error</button>
               <label class="flow-exec-inline-field">Error
                 <select data-flow-exec-control="error-select">
                   ${errors
                     .map(
                       (entry, index) =>
                         `<option value="${escapeHtml(entry.trackingId)}"${featureState.focusTrackingId === entry.trackingId ? " selected" : ""}>${escapeHtml(entry.actionName)} (${index + 1})</option>`
                     )
                     .join("")}
                 </select>
               </label>`
            : ""
        }
        <button type="button" class="flow-exec-action" data-flow-exec-action="expand-all">Expand All</button>
        <button type="button" class="flow-exec-action" data-flow-exec-action="collapse-all">Collapse All</button>
        <button type="button" class="flow-exec-action" data-flow-exec-action="toggle-variables">${featureState.showVariablePanel ? "Hide" : "Show"} Tracked Variables</button>
        <button type="button" class="flow-exec-action" data-flow-exec-action="show-final-variables">Final Variable State</button>
        <label class="flow-exec-inline-field">Search
          <input type="search" data-flow-exec-control="search" value="${escapeHtml(featureState.searchQuery)}" placeholder="Action name or type" />
        </label>
        <button type="button" class="flow-exec-action" data-flow-exec-action="search-prev">Previous Match</button>
        <button type="button" class="flow-exec-action" data-flow-exec-action="search-next">Next Match</button>
        <span class="flow-exec-match-count">${escapeHtml(getSearchMatches().length)} matches</span>
      </div>
      ${
        featureState.showVariablePanel
          ? `<div class="flow-exec-variable-panel">
              <label class="flow-exec-inline-field">Find Variable
                <input type="search" data-flow-exec-control="variable-search" value="${escapeHtml(featureState.variablePickerQuery)}" placeholder="Variable name" />
              </label>
              <label class="flow-exec-inline-field">Track Mode
                <select data-flow-exec-control="variable-mode">
                  <option value="tracked"${featureState.variableTrackMode === "tracked" ? " selected" : ""}>Tracked Variables</option>
                  <option value="changed"${featureState.variableTrackMode === "changed" ? " selected" : ""}>Variables Changed</option>
                </select>
              </label>
              <div class="flow-exec-variable-list">
                ${filterVariableNames(featureState.model?.variableIndex || [], featureState.variablePickerQuery)
                  .map(
                    (name) => `<label class="flow-exec-variable-option">
                      <input type="checkbox" data-flow-exec-control="track-variable" value="${escapeHtml(name)}"${featureState.trackedVariables.includes(name) ? " checked" : ""} />
                      ${escapeHtml(name)}
                    </label>`
                  )
                  .join("")}
              </div>
            </div>`
          : ""
      }
    </section>`;
  };

  const renderVariableTable = (rows, { valueColumnLabel = "Value", clickableNames = false, resultId = "", emptyMessage = "No variables to display.", scrollable = true } = {}) => {
    if (!rows.length) {
      return `<p class="muted">${escapeHtml(emptyMessage)}</p>`;
    }

    const wrapClass = scrollable ? "flow-exec-var-table-wrap flow-exec-var-table-wrap--scrollable" : "flow-exec-var-table-wrap";

    return `<div class="${wrapClass}">
      <table class="flow-exec-var-table">
        <thead>
          <tr>
            <th>Variable</th>
            <th>${escapeHtml(valueColumnLabel)}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((entry) => {
              const valueClass = entry.changed ? "flow-exec-var-value flow-exec-var-value--changed flow-exec-var-value--multiline" : "flow-exec-var-value flow-exec-var-value--multiline";
              const nameCell = clickableNames
                ? `<button type="button" class="flow-exec-var-link" data-flow-exec-action="show-variable-history" data-result-id="${escapeHtml(resultId)}" data-variable-name="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</button>`
                : escapeHtml(entry.name);
              return `<tr>
                <td class="flow-exec-var-name">${nameCell}</td>
                <td class="${valueClass}">${escapeHtml(entry.current.displayValue)}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;
  };

  const renderVariableHistoryTable = (entries) => {
    if (!entries.length) {
      return `<p class="muted">This variable was never updated during the execution.</p>`;
    }

    return `<div class="flow-exec-var-table-wrap">
      <table class="flow-exec-var-table">
        <thead>
          <tr>
            <th>Action Id</th>
            <th>New Value</th>
          </tr>
        </thead>
        <tbody>
          ${entries
            .map(
              (entry) => `<tr>
                <td>${escapeHtml(entry.actionId || entry.trackingId || "—")}</td>
                <td class="flow-exec-var-value flow-exec-var-value--multiline">${escapeHtml(entry.displayValue)}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
  };

  const renderCardVariableRail = (node, resultId) => {
    if (!featureState.trackedVariables.length) {
      return "";
    }

    const entries = getTrackedVariableDisplay(
      node,
      featureState.trackedVariables,
      "tracked",
      featureState.model
    );

    return `<aside class="flow-exec-card__variables">
      ${renderVariableTable(entries, { clickableNames: true, resultId, emptyMessage: "No tracked variables selected.", scrollable: false })}
    </aside>`;
  };

  const openFinalVariableStateModal = () => {
    if (!confirmModal || !featureState.model) {
      return;
    }

    const rows = getFinalVariableStates(featureState.model);
    confirmModal.open({
      title: "Final Variable State",
      bodyHtml: renderVariableTable(rows, { emptyMessage: "No variables were recorded for this execution.", scrollable: true }),
      confirmLabel: "Close",
      confirmHidden: true,
      cancelLabel: "Close",
    });
  };

  const openVariableHistoryModal = (variableName) => {
    if (!confirmModal || !featureState.model) {
      return;
    }

    const entries = getVariableHistoryEntries(featureState.model, variableName);
    confirmModal.open({
      title: `Variable History: ${variableName}`,
      bodyHtml: renderVariableHistoryTable(entries),
      confirmLabel: "Close",
      confirmHidden: true,
      cancelLabel: "Close",
    });
  };

  const formatObjectEntryValue = (value) => {
    if (value == null) {
      return "null";
    }
    if (typeof value === "object") {
      if (value.displayValue != null) {
        return value.displayValue;
      }
      if (typeof value.name === "string" && value.name) {
        return value.name;
      }
      if ("value" in value) {
        return formatObjectEntryValue(value.value);
      }
      const keys = Object.keys(value);
      if (
        keys.length &&
        keys.every((key) => value[key] && typeof value[key] === "object" && typeof value[key].name === "string" && value[key].name)
      ) {
        return keys.map((key) => `${key}: ${value[key].name}`).join("\n");
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  const renderKeyValueBlock = (record) => {
    if (record == null) {
      return "";
    }
    if (typeof record !== "object") {
      return `<div class="flow-exec-kv-list"><div class="flow-exec-kv-item">${escapeHtml(formatObjectEntryValue(record))}</div></div>`;
    }

    const entries = Object.entries(record);
    if (!entries.length) {
      return "";
    }

    return `<div class="flow-exec-kv-list">
      ${entries
        .map(
          ([key, value]) => `<div class="flow-exec-kv-item">
            <span class="flow-exec-kv-key">${escapeHtml(key)}:</span>
            <span class="flow-exec-kv-value">${escapeHtml(formatObjectEntryValue(value))}</span>
          </div>`
        )
        .join("")}
    </div>`;
  };

  const renderCardBody = (node) => `<div class="flow-exec-card__details">
    <div class="flow-exec-card__meta">
      <div><strong>Action ID:</strong> ${escapeHtml(node.actionId || "—")}</div>
      <div><strong>Execution ID:</strong> ${escapeHtml(node.executionId || "—")}</div>
      <div><strong>Task Name:</strong> ${escapeHtml(node.taskName || "—")}</div>
      <div><strong>Common Module:</strong> ${escapeHtml(node.commonModuleName || "—")}</div>
      <div><strong>Timestamp:</strong> ${escapeHtml(formatTimestamp(node.timestamp))}</div>
      <div><strong>Duration:</strong> ${escapeHtml(formatDuration(node.durationMs))}</div>
      <div><strong>Output Path:</strong> ${escapeHtml(node.outputPath || "—")}</div>
    </div>
    ${node.inputData ? `<h5>Input Data</h5>${renderKeyValueBlock(node.inputData)}` : ""}
    ${node.outputData ? `<h5>Output Data</h5>${renderKeyValueBlock(node.outputData)}` : ""}
    ${Object.keys(node.variables || {}).length ? `<h5>Variables</h5>${renderKeyValueBlock(node.variables)}` : ""}
    ${Object.keys(node.metadata || {}).length ? `<h5>Metadata</h5>${renderKeyValueBlock(node.metadata)}` : ""}
    ${node.errors?.length ? `<h5>Errors</h5>${renderJsonBlockFn(node.errors)}` : ""}
    ${node.warnings?.length ? `<h5>Warnings</h5>${renderJsonBlockFn(node.warnings)}` : ""}
  </div>`;

  const renderCard = (node, resultId) => {
    const searchTerm = featureState.searchQuery.trim().toLowerCase();
    const isMatch = searchTerm && nodeMatchesSearch(node, searchTerm);
    const isFocused = featureState.highlightTrackingId === node.trackingId || featureState.focusTrackingId === node.trackingId;
    const expanded = node.isGroup ? isExpanded(node.trackingId) : isExpanded(node.trackingId) || isFocused;
    const changedHighlight =
      featureState.variableTrackMode === "changed" &&
      featureState.trackedVariables.some((name) => node.changedVariables?.[name]);

    const classes = [
      "flow-exec-card",
      `flow-exec-card--${node.typeTone || "unknown"}`,
      node.isGroup ? "flow-exec-card--group" : "",
      isMatch ? "is-search-match" : "",
      isFocused ? "is-focused" : "",
      changedHighlight ? "is-variable-changed" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const header = `<div class="flow-exec-card__header">
      <button type="button" class="flow-exec-card__toggle" data-flow-exec-action="toggle-card" data-tracking-id="${escapeHtml(node.trackingId)}">
        <span class="flow-exec-card__number">[${escapeHtml(node.trackingId)}]</span>
        <span class="flow-exec-card__type">${escapeHtml(node.displayType)}</span>
        <span class="flow-exec-card__name">${escapeHtml(node.actionName)}</span>
        ${node.outputPath ? `<span class="flow-exec-card__path">${escapeHtml(node.outputPath)}</span>` : ""}
        <span class="flow-exec-card__time">${escapeHtml(formatClock(node.timestamp))}</span>
        ${node.durationMs ? `<span class="flow-exec-card__duration">${escapeHtml(formatDuration(node.durationMs))}</span>` : ""}
        ${
          node.isGroup
            ? `<span class="flow-exec-card__group-meta">${escapeHtml(node.childCount)} actions · ${escapeHtml(formatDuration(node.durationMs))}</span>`
            : ""
        }
      </button>
    </div>`;

    const body = expanded ? (node.isGroup && node.children.length ? `<div class="flow-exec-card__children">${node.children.map((child) => renderCard(child, resultId)).join("")}</div>` : renderCardBody(node)) : "";
    const variableRail = renderCardVariableRail(node, resultId);
    const layoutClass = variableRail ? "flow-exec-card__layout flow-exec-card__layout--with-vars" : "flow-exec-card__layout";

    return `<article class="${classes}" data-tracking-id="${escapeHtml(node.trackingId)}" id="${escapeHtml(node.id)}">
      <div class="${layoutClass}">
        <div class="flow-exec-card__main">${header}${body}</div>
        ${variableRail}
      </div>
    </article>`;
  };

  const renderTimeline = (resultId) =>
    `<section class="flow-exec-timeline">${(featureState.model?.nodes || []).map((node) => renderCard(node, resultId)).join("")}</section>`;

  const renderFeatureBody = (resultId) => {
    if (featureState.phase === "timeline" && featureState.model) {
      return `<div class="flow-exec-feature" data-result-id="${escapeHtml(resultId)}">
        <header class="flow-exec-header">
          <h2>Architect Execution Timeline</h2>
          <p class="flow-exec-subtitle">Chronological execution cards for ${escapeHtml(featureState.selectedExecution?.flowName || "selected flow")}.</p>
        </header>
        ${renderSummary()}
        ${renderTimeline(resultId)}
      </div>`;
    }

    return `<div class="flow-exec-feature" data-result-id="${escapeHtml(resultId)}">
      <header class="flow-exec-header">
        <h2>Flow Selection</h2>
        <p class="flow-exec-subtitle">Conversation <code>${escapeHtml(featureState.conversationId)}</code> — choose a flow execution to open in Genesys or the PS Tool timeline viewer.</p>
      </header>
      ${renderSelectionTable(resultId)}
    </div>`;
  };

  const rerenderFeature = (resultId) => {
    const exportMeta = state.exportData[resultId];
    const resultEl = document.getElementById(resultId);
    if (!exportMeta || !resultEl) {
      return;
    }

    const bodyEl = resultEl.querySelector(".export-results__body");
    if (bodyEl && typeof exportMeta.renderBody === "function") {
      bodyEl.innerHTML = exportMeta.renderBody(resultId, exportMeta);
    }
  };

  const scrollToTrackingId = (trackingId) => {
    const card =
      document.querySelector(`.flow-exec-card[data-tracking-id="${CSS.escape(String(trackingId))}"]`) ||
      document.getElementById(`flow-exec-card-${trackingId}`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const focusTrackingId = (trackingId, resultId) => {
    featureState.focusTrackingId = trackingId;
    featureState.highlightTrackingId = trackingId;
    buildExpandedTrackingIds(featureState.model, { focusTrackingId: trackingId }).forEach((id) => {
      featureState.expandedTrackingIds[id] = true;
    });
    featureState.expandedTrackingIds[trackingId] = true;
    rerenderFeature(resultId);
    scrollToTrackingId(trackingId);
  };

  const focusSearchMatch = (resultId, direction = 0) => {
    const matches = getSearchMatches();
    if (!matches.length) {
      return;
    }

    if (direction !== 0) {
      featureState.searchMatchIndex =
        (featureState.searchMatchIndex + direction + matches.length) % matches.length;
    }

    const match = matches[featureState.searchMatchIndex];
    if (match) {
      focusTrackingId(match.trackingId, resultId);
    }
  };

  const openTimeline = async ({ resultId, execution, credentials }) => {
    const loadingMessage = `Downloading execution history for "${execution.flowName}"...`;
    updateResultChrome(resultId, {
      title: "Architect Execution Timeline",
      status: loadingMessage,
    });
    updateResultBody(resultId, renderLoadingState(loadingMessage));

    const payload = await downloadFlowExecutionModel({
      ...credentials,
      instanceId: execution.id,
      conversationId: featureState.conversationId,
      flowName: execution.flowName,
      flowType: execution.flowType,
      flowVersion: execution.flowVersion,
    });

    const actionCount = payload.model?.summary?.actionsExecuted ?? 0;
    if (!actionCount) {
      const documentKeys = payload.parseMeta?.documentKeys?.join(", ") || "unknown";
      const actionRootPath = payload.parseMeta?.actionRootPath || "not found";
      const downloadBytes = payload.downloadMeta?.byteLength ?? 0;
      throw new Error(
        `Execution data downloaded (${downloadBytes} bytes) but no actions were found. Document keys: ${documentKeys}. Action root: ${actionRootPath}.`
      );
    }

    featureState.phase = "timeline";
    featureState.selectedExecution = execution;
    featureState.model = payload.model;
    featureState.expandedTrackingIds = {};
    featureState.searchQuery = "";
    featureState.searchMatchIndex = 0;
    featureState.trackedVariables = [];
    featureState.focusTrackingId = null;
    featureState.highlightTrackingId = null;

    const status = `${actionCount} actions parsed`;
    const exportMeta = buildTimelineExportMeta(resultId, status);
    setExportMeta(resultId, exportMeta);
    await finishExportResult(resultId, exportMeta.title, status, "", exportMeta);
  };

  const loadSelection = async (conversationId, resultId) => {
    const credentials = getCredentials();
    if (!credentials) {
      return;
    }

    featureState = {
      ...defaultViewerState(),
      conversationId,
    };

    const payload = await fetchFlowExecutions({ ...credentials, conversationId });
    featureState.executions = (payload.executions || []).map(normalizeExecutionRow);

    const exportMeta = {
      title: "Flow Execution",
      status: `${featureState.executions.length} executions found`,
      exportType: "flow_execution_timeline",
      hideActions: true,
      editable: false,
      renderBody: () => renderFeatureBody(resultId),
    };

    state.exportData[resultId] = exportMeta;
    finishExportResult(resultId, exportMeta.title, exportMeta.status, "", exportMeta);
  };

  const handleClick = async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return false;
    }

    const actionEl = target.closest("[data-flow-exec-action]");
    if (!actionEl) {
      return false;
    }

    const resultId = actionEl.getAttribute("data-result-id") || actionEl.closest("[data-result-id]")?.getAttribute("data-result-id") || "";
    if (!resultId) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const action = actionEl.getAttribute("data-flow-exec-action");
    const credentials = getCredentials();
    if (!credentials) {
      return true;
    }

    try {
      if (action === "open-ps-tool") {
        const instanceId = actionEl.getAttribute("data-instance-id") || "";
        const execution = featureState.executions.find((entry) => entry.id === instanceId);
        if (execution) {
          try {
            await openTimeline({ resultId, execution, credentials });
          } catch (error) {
            const exportMeta = buildTimelineExportMeta(
              resultId,
              error.message || "Flow execution download failed."
            );
            setExportMeta(resultId, exportMeta);
            updateResultBody(
              resultId,
              renderJsonBlockFn({ error: error.message || "Flow execution download failed." })
            );
            updateResultChrome(resultId, {
              title: exportMeta.title,
              status: exportMeta.status,
            });
          }
        }
        return true;
      }

      if (action === "back-selection") {
        featureState.phase = "selection";
        featureState.model = null;
        featureState.selectedExecution = null;
        const exportMeta = {
          ...getExportMeta(resultId),
          title: "Flow Execution",
          status: `${featureState.executions.length} executions found`,
          statusBase: `${featureState.executions.length} executions found`,
          renderBody: () => renderFeatureBody(resultId),
        };
        setExportMeta(resultId, exportMeta);
        await finishExportResult(resultId, exportMeta.title, exportMeta.status, "", exportMeta);
        return true;
      }

      if (action === "toggle-card") {
        const trackingId = Number(actionEl.getAttribute("data-tracking-id"));
        setExpanded(trackingId, !isExpanded(trackingId));
        rerenderFeature(resultId);
        return true;
      }

      if (action === "expand-all") {
        featureState.model?.flatNodes?.forEach((node) => {
          if (node.isGroup) {
            setExpanded(node.trackingId, true);
          }
          setExpanded(node.trackingId, true);
        });
        rerenderFeature(resultId);
        return true;
      }

      if (action === "collapse-all") {
        featureState.expandedTrackingIds = {};
        rerenderFeature(resultId);
        return true;
      }

      if (action === "goto-first-error") {
        const errors = getErrorTargets();
        if (errors[0]) {
          focusTrackingId(errors[0].trackingId, resultId);
        }
        return true;
      }

      if (action === "search-prev") {
        focusSearchMatch(resultId, -1);
        return true;
      }

      if (action === "search-next") {
        focusSearchMatch(resultId, 1);
        return true;
      }

      if (action === "toggle-variables") {
        featureState.showVariablePanel = !featureState.showVariablePanel;
        rerenderFeature(resultId);
        return true;
      }

      if (action === "show-final-variables") {
        openFinalVariableStateModal();
        return true;
      }

      if (action === "show-variable-history") {
        const variableName = actionEl.getAttribute("data-variable-name") || "";
        if (variableName) {
          openVariableHistoryModal(variableName);
        }
        return true;
      }
    } catch (error) {
      const exportMeta = buildTimelineExportMeta(resultId, error.message || "Flow execution viewer failed.");
      setExportMeta(resultId, exportMeta);
      updateResultBody(
        resultId,
        renderJsonBlockFn({ error: error.message || "Flow execution viewer failed." })
      );
      updateResultChrome(resultId, {
        title: exportMeta.title,
        status: exportMeta.status,
      });
    }

    return true;
  };

  const handleChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const resultId = target.closest("[data-result-id]")?.getAttribute("data-result-id") || "";
    if (!resultId || !featureState.model) {
      return false;
    }

    if (target.matches('[data-flow-exec-control="search"]')) {
      featureState.searchQuery = target.value || "";
      featureState.searchMatchIndex = 0;
      buildExpandedTrackingIds(featureState.model, { searchQuery: featureState.searchQuery }).forEach((trackingId) => {
        featureState.expandedTrackingIds[trackingId] = true;
      });
      rerenderFeature(resultId);
      return true;
    }

    if (target.matches('[data-flow-exec-control="error-select"]')) {
      focusTrackingId(Number(target.value), resultId);
      return true;
    }

    if (target.matches('[data-flow-exec-control="variable-search"]')) {
      featureState.variablePickerQuery = target.value || "";
      rerenderFeature(resultId);
      return true;
    }

    if (target.matches('[data-flow-exec-control="variable-mode"]')) {
      featureState.variableTrackMode = target.value === "changed" ? "changed" : "tracked";
      rerenderFeature(resultId);
      return true;
    }

    if (target.matches('[data-flow-exec-control="track-variable"]')) {
      const name = target.value;
      if (target.checked) {
        if (!featureState.trackedVariables.includes(name)) {
          featureState.trackedVariables.push(name);
        }
      } else {
        featureState.trackedVariables = featureState.trackedVariables.filter((entry) => entry !== name);
      }
      rerenderFeature(resultId);
      return true;
    }

    return false;
  };

  const wireButton = (button, getConversationId) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      const conversationId = getConversationId();
      if (!conversationId) {
        return;
      }

      const loadingResultId = startExportResult(
        "Flow Execution",
        "Loading flow executions...",
        renderLoadingState(`Fetching flow executions for "${conversationId}"...`)
      );

      try {
        await loadSelection(conversationId, loadingResultId);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Flow Execution",
          error.message || "Flow execution lookup failed.",
          renderJsonBlockFn({ error: error.message || "Flow execution lookup failed." })
        );
      }
    });
  };

  return {
    handleClick,
    handleChange,
    wireButton,
  };
};

export { createFlowExecutionFeature, normalizeExecutionRow };
