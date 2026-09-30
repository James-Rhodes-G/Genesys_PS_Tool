import {
  renderGuxFieldCheckbox,
  renderGuxFieldSelect,
  renderGuxFieldText,
  resolveDropdownChange,
} from "./gux-ui.js";
import { renderDisconnectConfirmBody } from "./bulk-confirm.js";
import { buildBulkCompletionStatus, executeBulkJobWithProgress } from "./bulk-utils.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const BULK_KIND = "disconnect";
const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_LOOKBACK_DAYS = 90;
const INTERACTION_CHECKBOX_CLASS = "bulk-disconnect-interaction-checkbox";
const MEDIA_TYPE_OPTIONS = ["voice", "chat", "email", "message", "callback"];
const DEFAULT_MEDIA_TYPES = ["voice", "chat"];
const DEFAULT_SELECTED_COLUMN_KEYS = [
  "conversationId",
  "startTime",
  "currentDuration",
  "mediaType",
  "direction",
  "ani",
  "dnis",
  "purpose",
];

const formatInteractionDuration = (startTime) => {
  const startedAt = Date.parse(String(startTime || ""));
  if (!Number.isFinite(startedAt)) {
    return "";
  }

  const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};

const formatDateTimeDisplay = (value) => {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) {
    return String(value || "");
  }

  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
};

const getSelectedInteractions = (exportMeta) => Object.values(exportMeta.selectedInteractionsById || {});

const buildConversationLink = (conversationId, getCurrentAppDomain) => {
  const safeId = escapeHtml(conversationId || "");
  const appDomain = getCurrentAppDomain();

  if (!safeId || !appDomain) {
    return safeId;
  }

  return `<a href="https://apps.${escapeHtml(appDomain)}/directory/#/analytics/interactions/${safeId}/admin" target="_blank" rel="noreferrer noopener">${safeId}</a>`;
};

const createBulkDisconnectInteractionColumns = ({ getCurrentAppDomain }) => [
  {
    key: "conversationId",
    header: "Conversation ID",
    renderCell: (row) => buildConversationLink(row.conversationId, getCurrentAppDomain),
    toCsv: (row) => row.conversationId || "",
  },
  {
    key: "startTime",
    header: "Start Time",
    getValues: (row) => [formatDateTimeDisplay(row.startTime)].filter(Boolean),
    toCsv: (row) => row.startTime || "",
  },
  {
    key: "currentDuration",
    header: "Current Duration",
    getValues: (row) => [formatInteractionDuration(row.startTime)].filter(Boolean),
    toCsv: (row) => formatInteractionDuration(row.startTime),
  },
  { key: "mediaType", header: "Media Type" },
  { key: "direction", header: "Direction" },
  { key: "ani", header: "ANI" },
  { key: "dnis", header: "DNIS" },
  { key: "purpose", header: "Purpose / State" },
  {
    key: "agentName",
    header: "Agent",
    getValues: (row) => [row.agentName].filter(Boolean),
    toCsv: (row) => row.agentName || "",
  },
];

const createBulkDisconnectResultsMeta = (resultId, rows, title, status) => ({
  resultId,
  title,
  status,
  exportType: "bulk_disconnect_results",
  rows,
  editMode: false,
  availableColumns: [
    { key: "conversationId", header: "Conversation ID" },
    { key: "startTime", header: "Start Time" },
    { key: "mediaType", header: "Media Type" },
    { key: "direction", header: "Direction" },
    { key: "ani", header: "ANI" },
    { key: "dnis", header: "DNIS" },
    { key: "status", header: "Status" },
    { key: "error", header: "Error" },
  ],
  selectedColumnKeys: ["conversationId", "startTime", "mediaType", "direction", "ani", "dnis", "status", "error"],
});

const createBulkDisconnectSelectionMeta = ({
  resultId,
  title,
  status,
  rows,
  queueOptions,
  queueId,
  queueName,
  scope,
  lookbackDays,
  minDurationMinutes,
  mediaTypes,
  getCurrentAppDomain,
}) => {
  const availableColumns = createBulkDisconnectInteractionColumns({ getCurrentAppDomain });

  return {
    kind: BULK_KIND,
    resultId,
    title,
    status,
    exportType: "bulk_disconnect",
    rows,
    editMode: false,
    editable: true,
    queueOptions,
    queueId,
    queueName,
    scope: scope || "all-open",
    lookbackDays: String(lookbackDays ?? DEFAULT_LOOKBACK_DAYS),
    minDurationMinutes: String(minDurationMinutes ?? 0),
    mediaTypes: Array.isArray(mediaTypes) ? mediaTypes : DEFAULT_MEDIA_TYPES,
    selectedInteractionsById: {},
    availableColumns,
    selectedColumnKeys: DEFAULT_SELECTED_COLUMN_KEYS,
    leadingColumns: [
      {
        key: "select",
        header: "Select",
      },
    ],
  };
};

const renderMediaTypeFilters = (resultId, exportMeta) =>
  MEDIA_TYPE_OPTIONS.map(
    (mediaType) =>
      `<div class="bulk-disconnect-media-type">${renderGuxFieldCheckbox({
        escapeHtml,
        className: "bulk-disconnect-media-type-checkbox",
        label: mediaType,
        checked: (exportMeta.mediaTypes || []).includes(mediaType),
        attrs: `data-result-id="${escapeHtml(resultId)}" data-media-type="${escapeHtml(mediaType)}"`,
        labelPosition: "beside",
      })}</div>`
  ).join("");

const renderSetup = (resultId, exportMeta) => {
  const queueOptions = exportMeta.queueOptions || [];
  const selectedQueueId = String(exportMeta.queueId || "");
  const scope = String(exportMeta.scope || "all-open");

  return `<div class="column-editor">
    <div class="column-editor__header">Bulk Disconnect Interactions</div>
    <p class="muted">Load open interactions for a queue, select rows, then disconnect them. Genesys only returns conversations that started within the lookback window, so increase lookback to find older open interactions.</p>
    <div class="sidebar-actions bulk-disconnect-filters">
      ${renderGuxFieldSelect({
        escapeHtml,
        inputId: `${resultId}-bulk-disconnect-queue`,
        className: "bulk-disconnect-queue-select",
        label: "Queue",
        optionsHtml: `<option value="">Select queue</option>${queueOptions
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}"${
                option.value === selectedQueueId ? " selected" : ""
              }>${escapeHtml(option.label)}</option>`
          )
          .join("")}`,
        attrs: `data-result-id="${escapeHtml(resultId)}"`,
      })}
      ${renderGuxFieldSelect({
        escapeHtml,
        inputId: `${resultId}-bulk-disconnect-scope`,
        className: "bulk-disconnect-scope-select",
        label: "Interaction Scope",
        optionsHtml: `<option value="all-open"${scope === "all-open" ? " selected" : ""}>All open in queue</option><option value="waiting"${
          scope === "waiting" ? " selected" : ""
        }>Waiting in queue only</option><option value="agent"${scope === "agent" ? " selected" : ""}>Connected to agent</option>`,
        attrs: `data-result-id="${escapeHtml(resultId)}"`,
      })}
      ${renderGuxFieldText({
        escapeHtml,
        inputId: `${resultId}-bulk-disconnect-lookback`,
        className: "bulk-disconnect-lookback-input",
        label: "Lookback Days",
        type: "number",
        value: String(exportMeta.lookbackDays ?? DEFAULT_LOOKBACK_DAYS),
        attrs: `data-result-id="${escapeHtml(resultId)}" min="1" max="${MAX_LOOKBACK_DAYS}"`,
      })}
      ${renderGuxFieldText({
        escapeHtml,
        inputId: `${resultId}-bulk-disconnect-min-duration`,
        className: "bulk-disconnect-min-duration-input",
        label: "Minimum Duration (minutes)",
        type: "number",
        value: String(exportMeta.minDurationMinutes ?? 0),
        attrs: `data-result-id="${escapeHtml(resultId)}" min="0"`,
      })}
      <div class="field-container">
        <div class="bulk-disconnect-media-types">
          <div class="bulk-disconnect-media-types__label">Media Types</div>
          <div class="bulk-disconnect-media-types__options">${renderMediaTypeFilters(resultId, exportMeta)}</div>
        </div>
      </div>
      <div class="bulk-control-row bulk-control-row--actions">
        <gux-button class="bulk-disconnect-load" type="button" accent="primary" data-result-id="${escapeHtml(
          resultId
        )}">Load Interactions</gux-button>
        <gux-button class="bulk-disconnect-refresh" type="button" accent="secondary" data-result-id="${escapeHtml(
          resultId
        )}">Refresh</gux-button>
      </div>
    </div>
  </div>`;
};

const renderSelectionControls = (resultId, exportMeta, { renderSelectCell }) => {
  const rows = exportMeta.rows || [];
  const selectedIds = new Set(Object.keys(exportMeta.selectedInteractionsById || {}));
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.conversationId));

  exportMeta.leadingColumns = [
    {
      key: "select",
      header: "Select",
      renderCell: (row) => renderSelectCell(row, exportMeta),
    },
  ];

  return `<div class="bulk-disconnect-selection">
    ${renderGuxFieldCheckbox({
      escapeHtml,
      inputId: `${resultId}-select-all-interactions`,
      className: "bulk-disconnect-select-all",
      label: `<span class="bulk-select-all-label">Select All Interactions (${rows.length})</span>`,
      checked: allSelected,
      attrs: `data-result-id="${escapeHtml(resultId)}"`,
    })}
    <span class="muted bulk-selection-summary">${selectedIds.size} of ${rows.length} selected</span>
  </div>`;
};

const createBulkDisconnectFeature = ({
  state,
  getQueues,
  queryOpenQueueInteractions,
  disconnectConversationsViaJob,
  requireCredentials,
  startExportResult,
  finishExportResult,
  rerenderExportSection,
  prependExportResult,
  renderLoadingState,
  renderJsonBlock,
  renderEditableTableContent,
  confirmModal,
  getCurrentAppDomain,
}) => {
  const renderSelectCell = (row, exportMeta) => {
    const conversationId = row?.conversationId || "";
    if (!conversationId) {
      return "";
    }

    const checked = Boolean(exportMeta.selectedInteractionsById?.[conversationId]);

    return renderGuxFieldCheckbox({
      escapeHtml,
      className: INTERACTION_CHECKBOX_CLASS,
      label: "",
      checked,
      attrs: `data-result-id="${escapeHtml(exportMeta.resultId)}" data-conversation-id="${escapeHtml(conversationId)}"`,
      labelPosition: "screenreader",
    });
  };

  const renderBulkDisconnectBody = (resultId, exportMeta) => {
    const rows = exportMeta.rows || [];
    const selectionControlsHtml = rows.length
      ? renderSelectionControls(resultId, exportMeta, { renderSelectCell })
      : "";
    const tableHtml = rows.length
      ? renderEditableTableContent(resultId)
      : '<p class="muted">Load interactions to populate the table.</p>';
    const selectedCount = Object.keys(exportMeta.selectedInteractionsById || {}).length;

    return `${renderSetup(resultId, exportMeta)}
${selectionControlsHtml}
${tableHtml}
<div class="bulk-skill-actions">
  <gux-button class="bulk-disconnect-apply" type="button" accent="primary" data-result-id="${escapeHtml(
    resultId
  )}">Disconnect Selected Interactions</gux-button>
  <span class="muted bulk-selection-summary">${selectedCount} interaction(s) selected</span>
</div>`;
  };

  const readSetupFromDom = (resultEl, exportMeta) => {
    const queueControl = resultEl.querySelector(".bulk-disconnect-queue-select");
    const scopeControl = resultEl.querySelector(".bulk-disconnect-scope-select");
    const lookbackControl = resultEl.querySelector(".bulk-disconnect-lookback-input");
    const minDurationControl = resultEl.querySelector(".bulk-disconnect-min-duration-input");

    exportMeta.queueId = queueControl ? String(queueControl.value || "").trim() : exportMeta.queueId;
    exportMeta.scope = scopeControl ? String(scopeControl.value || "all-open").trim() : exportMeta.scope;
    exportMeta.lookbackDays = lookbackControl
      ? String(lookbackControl.value || String(DEFAULT_LOOKBACK_DAYS)).trim()
      : exportMeta.lookbackDays;
    exportMeta.minDurationMinutes = minDurationControl
      ? String(minDurationControl.value || "0").trim()
      : exportMeta.minDurationMinutes;

    const checkedMediaTypes = Array.from(
      resultEl.querySelectorAll(".bulk-disconnect-media-type-checkbox:checked")
    )
      .map((input) => input.getAttribute("data-media-type"))
      .filter(Boolean);

    if (checkedMediaTypes.length > 0) {
      exportMeta.mediaTypes = checkedMediaTypes;
    }
  };

  const loadInteractions = async (resultId, exportMeta, { preserveSelection = false } = {}) => {
    const credentials = requireCredentials("Bulk Disconnect");
    const resultEl = resultId ? document.getElementById(resultId) : null;
    if (!credentials || !resultEl || !exportMeta) {
      return;
    }

    readSetupFromDom(resultEl, exportMeta);

    if (!exportMeta.queueId) {
      prependExportResult(
        "Bulk Disconnect",
        "Queue required",
        '<p class="muted">Select a queue before loading interactions.</p>'
      );
      return;
    }

    const selectedQueue = (exportMeta.queueOptions || []).find((option) => option.value === exportMeta.queueId);
    exportMeta.queueName = selectedQueue?.label || exportMeta.queueId;

    const previousSelection = preserveSelection ? { ...(exportMeta.selectedInteractionsById || {}) } : {};

    resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
      `Loading open interactions for ${exportMeta.queueName}...`
    );

    try {
      const interactions = await queryOpenQueueInteractions({
        ...credentials,
        queueId: exportMeta.queueId,
        lookbackDays: Number(exportMeta.lookbackDays) || DEFAULT_LOOKBACK_DAYS,
        scope: exportMeta.scope || "all-open",
        mediaTypes: exportMeta.mediaTypes || DEFAULT_MEDIA_TYPES,
        minDurationMinutes: Number(exportMeta.minDurationMinutes) || 0,
      });

      const nextSelection = {};
      if (preserveSelection) {
        interactions.forEach((interaction) => {
          if (previousSelection[interaction.conversationId]) {
            nextSelection[interaction.conversationId] = interaction;
          }
        });
      }

      const title = `Bulk Disconnect - ${exportMeta.queueName}`;
      const status = `Loaded ${interactions.length} open interaction(s)`;
      const nextMeta = createBulkDisconnectSelectionMeta({
        resultId,
        title,
        status,
        rows: interactions,
        queueOptions: exportMeta.queueOptions,
        queueId: exportMeta.queueId,
        queueName: exportMeta.queueName,
        scope: exportMeta.scope,
        lookbackDays: exportMeta.lookbackDays,
        minDurationMinutes: exportMeta.minDurationMinutes,
        mediaTypes: exportMeta.mediaTypes,
        getCurrentAppDomain,
      });
      nextMeta.selectedInteractionsById = nextSelection;
      nextMeta.renderBody = () => renderBulkDisconnectBody(resultId, state.exportData[resultId]);

      state.exportData[resultId] = nextMeta;
      finishExportResult(resultId, title, status, "", nextMeta);
    } catch (error) {
      finishExportResult(
        resultId,
        exportMeta.title || "Bulk Disconnect",
        error.message || "Failed to load interactions",
        renderJsonBlock(error.payload || { error: error.message || "Failed to load interactions" })
      );
    }
  };

  const executeDisconnect = async (resultId, exportMeta) => {
    const resultEl = document.getElementById(resultId);
    if (!resultEl || !exportMeta) {
      return;
    }

    const selectedInteractions = getSelectedInteractions(exportMeta);
    const credentials = requireCredentials("Bulk Disconnect");
    if (!credentials) {
      return;
    }

    try {
      const { job, results } = await executeBulkJobWithProgress({
        resultId,
        exportMeta,
        state,
        totalItems: selectedInteractions.length,
        actionMessage: `Disconnecting ${selectedInteractions.length} interaction(s)...`,
        cancelLabel: "Cancel Disconnect",
        unitLabel: "interactions",
        credentials,
        renderProgressBody: renderBulkDisconnectBody,
        runJob: (jobOptions) =>
          disconnectConversationsViaJob({
            ...jobOptions,
            conversationIds: selectedInteractions.map((interaction) => interaction.conversationId),
          }),
      });

      const resultRows = selectedInteractions.map((interaction) => {
        const disconnectResult = results.find((entry) => entry.conversationId === interaction.conversationId);
        return {
          conversationId: interaction.conversationId,
          startTime: interaction.startTime,
          mediaType: interaction.mediaType,
          direction: interaction.direction,
          ani: interaction.ani,
          dnis: interaction.dnis,
          status: disconnectResult?.status || "unknown",
          error: disconnectResult?.error || "",
        };
      });
      const status = buildBulkCompletionStatus(resultRows, { job });

      finishExportResult(
        resultId,
        "Bulk Disconnect",
        status,
        "",
        createBulkDisconnectResultsMeta(resultId, resultRows, "Bulk Disconnect", status)
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        finishExportResult(
          resultId,
          "Bulk Disconnect",
          "Disconnect cancelled.",
          '<p class="muted">Bulk disconnect was cancelled before completion.</p>'
        );
        return;
      }

      finishExportResult(
        resultId,
        "Bulk Disconnect",
        error.message || "Bulk disconnect failed",
        renderJsonBlock(error.payload || { error: error.message || "Bulk disconnect failed" })
      );
    }
  };

  const refreshSelectionUi = (resultId, exportMeta) => {
    const resultEl = document.getElementById(resultId);
    if (!resultEl || !exportMeta) {
      return;
    }

    const summaryEls = resultEl.querySelectorAll(".bulk-selection-summary");
    const selectedCount = Object.keys(exportMeta.selectedInteractionsById || {}).length;
    const rowCount = (exportMeta.rows || []).length;
    summaryEls.forEach((summaryEl) => {
      if (summaryEl.closest(".bulk-disconnect-selection")) {
        summaryEl.textContent = `${selectedCount} of ${rowCount} selected`;
        return;
      }

      summaryEl.textContent = `${selectedCount} interaction(s) selected`;
    });
  };

  const handleInteractionSelectionChange = (event) => {
    const target = event.target;

    if (target instanceof HTMLInputElement && target.classList.contains(INTERACTION_CHECKBOX_CLASS)) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      const conversationId = target.getAttribute("data-conversation-id");
      const interaction = (exportMeta?.rows || []).find((row) => row.conversationId === conversationId);

      if (!resultId || !exportMeta || !conversationId || !interaction) {
        return true;
      }

      exportMeta.selectedInteractionsById = { ...(exportMeta.selectedInteractionsById || {}) };
      if (target.checked) {
        exportMeta.selectedInteractionsById[conversationId] = interaction;
      } else {
        delete exportMeta.selectedInteractionsById[conversationId];
      }

      refreshSelectionUi(resultId, exportMeta);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-disconnect-select-all")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return true;
      }

      exportMeta.selectedInteractionsById = {};
      if (target.checked) {
        (exportMeta.rows || []).forEach((interaction) => {
          if (interaction.conversationId) {
            exportMeta.selectedInteractionsById[interaction.conversationId] = interaction;
          }
        });
      }

      rerenderExportSection(resultId);
      return true;
    }

    return false;
  };

  const wireButton = (button, { hasConnection }) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!hasConnection()) {
        return;
      }

      const credentials = requireCredentials("Bulk Disconnect");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Bulk Disconnect",
        "Loading queues...",
        renderLoadingState('Fetching "/api/v2/routing/queues"...')
      );

      try {
        const queues = await getQueues(credentials);
        const queueOptions = queues
          .slice()
          .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")))
          .map((queue) => ({ value: queue.id, label: queue.name || queue.id }));

        const exportMeta = createBulkDisconnectSelectionMeta({
          resultId: loadingResultId,
          title: "Bulk Disconnect",
          status: "Select a queue and load interactions",
          rows: [],
          queueOptions,
          queueId: "",
          queueName: "",
          scope: "all-open",
          lookbackDays: DEFAULT_LOOKBACK_DAYS,
          minDurationMinutes: 0,
          mediaTypes: DEFAULT_MEDIA_TYPES,
          getCurrentAppDomain,
        });
        exportMeta.renderBody = () => renderBulkDisconnectBody(loadingResultId, state.exportData[loadingResultId]);

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Bulk Disconnect",
          error.message || "Bulk disconnect load failed",
          renderJsonBlock(error.payload || { error: error.message || "Bulk disconnect load failed" })
        );
      }
    });
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const loadButton = target.closest(".bulk-disconnect-load");
    if (loadButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = loadButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (resultId && exportMeta) {
        await loadInteractions(resultId, exportMeta);
      }
      return true;
    }

    const refreshButton = target.closest(".bulk-disconnect-refresh");
    if (refreshButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = refreshButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (resultId && exportMeta) {
        await loadInteractions(resultId, exportMeta, { preserveSelection: true });
      }
      return true;
    }

    const applyButton = target.closest(".bulk-disconnect-apply");
    if (!applyButton) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const resultId = applyButton.getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    if (!resultId || !exportMeta) {
      return true;
    }

    const selectedInteractions = getSelectedInteractions(exportMeta);
    if (selectedInteractions.length === 0) {
      prependExportResult(
        "Bulk Disconnect",
        "No interactions selected",
        '<p class="muted">Select at least one interaction before disconnecting.</p>'
      );
      return true;
    }

    confirmModal.open({
      resultId,
      title: "Confirm Interaction Disconnect",
      bodyHtml: renderDisconnectConfirmBody({ interactions: selectedInteractions }),
      confirmLabel: "Disconnect Interactions",
      onConfirm: async ({ resultId: confirmedResultId, close }) => {
        const confirmedMeta = confirmedResultId ? state.exportData[confirmedResultId] : null;
        if (!confirmedMeta) {
          close();
          return;
        }
        close();
        await executeDisconnect(confirmedResultId, confirmedMeta);
      },
    });
    return true;
  };

  const handleChange = (event) => {
    if (handleInteractionSelectionChange(event)) {
      return true;
    }

    const queueChange = resolveDropdownChange(event.target, "bulk-disconnect-queue-select");
    if (queueChange) {
      const exportMeta = queueChange.resultId ? state.exportData[queueChange.resultId] : null;
      if (exportMeta) {
        exportMeta.queueId = queueChange.value;
        const selectedQueue = (exportMeta.queueOptions || []).find((option) => option.value === queueChange.value);
        exportMeta.queueName = selectedQueue?.label || queueChange.value;
      }
      return true;
    }

    const scopeChange = resolveDropdownChange(event.target, "bulk-disconnect-scope-select");
    if (scopeChange) {
      const exportMeta = scopeChange.resultId ? state.exportData[scopeChange.resultId] : null;
      if (exportMeta) {
        exportMeta.scope = scopeChange.value || "all-open";
      }
      return true;
    }

    const target = event.target;
    if (target instanceof HTMLInputElement && target.classList.contains("bulk-disconnect-media-type-checkbox")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (exportMeta) {
        const mediaType = target.getAttribute("data-media-type");
        const nextMediaTypes = new Set(exportMeta.mediaTypes || DEFAULT_MEDIA_TYPES);
        if (target.checked) {
          nextMediaTypes.add(mediaType);
        } else {
          nextMediaTypes.delete(mediaType);
        }
        exportMeta.mediaTypes = [...nextMediaTypes];
      }
      return true;
    }

    return false;
  };

  return { wireButton, handleClick, handleChange };
};

export {
  BULK_KIND,
  createBulkDisconnectFeature,
  createBulkDisconnectResultsMeta,
  formatInteractionDuration,
};
