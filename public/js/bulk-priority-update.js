import {
  renderGuxFieldCheckbox,
  renderGuxFieldSelect,
  renderGuxFieldText,
  resolveDropdownChange,
} from "./gux-ui.js";
import { formatInteractionDuration } from "./bulk-disconnect.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const BULK_KIND = "priority-update";
const INTERACTION_CHECKBOX_CLASS = "bulk-priority-interaction-checkbox";
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

const createBulkPriorityInteractionColumns = ({ getCurrentAppDomain }) => [
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
];

const createBulkPriorityResultsMeta = (resultId, rows, title, status) => ({
  resultId,
  title,
  status,
  exportType: "bulk_priority_update",
  rows,
  editMode: false,
  availableColumns: [
    { key: "conversationId", header: "Conversation ID" },
    { key: "priority", header: "Priority" },
    { key: "startTime", header: "Start Time" },
    { key: "mediaType", header: "Media Type" },
    { key: "status", header: "Status" },
    { key: "error", header: "Error" },
  ],
  selectedColumnKeys: ["conversationId", "priority", "startTime", "mediaType", "status", "error"],
});

const createBulkPrioritySelectionMeta = ({
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
  startingPriority,
  getCurrentAppDomain,
}) => ({
  kind: BULK_KIND,
  resultId,
  title,
  status,
  exportType: "bulk_priority_update_selection",
  rows,
  editMode: false,
  editable: true,
  queueOptions,
  queueId,
  queueName,
  scope: scope || "all-open",
  lookbackDays: String(lookbackDays ?? 7),
  minDurationMinutes: String(minDurationMinutes ?? 0),
  mediaTypes: Array.isArray(mediaTypes) ? mediaTypes : DEFAULT_MEDIA_TYPES,
  startingPriority: String(startingPriority ?? 100),
  selectedInteractionsById: {},
  availableColumns: createBulkPriorityInteractionColumns({ getCurrentAppDomain }),
  selectedColumnKeys: DEFAULT_SELECTED_COLUMN_KEYS,
  leadingColumns: [{ key: "select", header: "Select" }],
});

const renderMediaTypeFilters = (resultId, exportMeta) =>
  MEDIA_TYPE_OPTIONS.map(
    (mediaType) =>
      `<div class="bulk-disconnect-media-type">${renderGuxFieldCheckbox({
        escapeHtml,
        className: "bulk-priority-media-type-checkbox",
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
    <div class="column-editor__header">Interaction Priority Updater</div>
    <p class="muted">Load open interactions for a queue, select rows, then update priorities. Each selected interaction receives a decrementing priority starting from the value below.</p>
    <div class="sidebar-actions bulk-disconnect-filters">
      ${renderGuxFieldSelect({
        escapeHtml,
        inputId: `${resultId}-bulk-priority-queue`,
        className: "bulk-priority-queue-select",
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
        inputId: `${resultId}-bulk-priority-scope`,
        className: "bulk-priority-scope-select",
        label: "Interaction Scope",
        optionsHtml: `<option value="all-open"${scope === "all-open" ? " selected" : ""}>All open in queue</option><option value="waiting"${
          scope === "waiting" ? " selected" : ""
        }>Waiting in queue only</option><option value="agent"${scope === "agent" ? " selected" : ""}>Connected to agent</option>`,
        attrs: `data-result-id="${escapeHtml(resultId)}"`,
      })}
      ${renderGuxFieldText({
        escapeHtml,
        inputId: `${resultId}-bulk-priority-lookback`,
        className: "bulk-priority-lookback-input",
        label: "Lookback Days",
        type: "number",
        value: String(exportMeta.lookbackDays ?? 7),
        attrs: `data-result-id="${escapeHtml(resultId)}" min="1" max="30"`,
      })}
      ${renderGuxFieldText({
        escapeHtml,
        inputId: `${resultId}-bulk-priority-min-duration`,
        className: "bulk-priority-min-duration-input",
        label: "Minimum Duration (minutes)",
        type: "number",
        value: String(exportMeta.minDurationMinutes ?? 0),
        attrs: `data-result-id="${escapeHtml(resultId)}" min="0"`,
      })}
      ${renderGuxFieldText({
        escapeHtml,
        inputId: `${resultId}-bulk-priority-starting`,
        className: "bulk-priority-starting-input",
        label: "Starting Priority",
        type: "number",
        value: String(exportMeta.startingPriority ?? 100),
        attrs: `data-result-id="${escapeHtml(resultId)}"`,
      })}
      <div class="field-container">
        <div class="bulk-disconnect-media-types">
          <div class="bulk-disconnect-media-types__label">Media Types</div>
          <div class="bulk-disconnect-media-types__options">${renderMediaTypeFilters(resultId, exportMeta)}</div>
        </div>
      </div>
      <div class="bulk-control-row bulk-control-row--actions">
        <gux-button class="bulk-priority-load" type="button" accent="primary" data-result-id="${escapeHtml(
          resultId
        )}">Load Interactions</gux-button>
        <gux-button class="bulk-priority-refresh" type="button" accent="secondary" data-result-id="${escapeHtml(
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
      className: "bulk-priority-select-all",
      label: `<span class="bulk-select-all-label">Select All Interactions (${rows.length})</span>`,
      checked: allSelected,
      attrs: `data-result-id="${escapeHtml(resultId)}"`,
    })}
    <span class="muted bulk-selection-summary">${selectedIds.size} of ${rows.length} selected</span>
  </div>`;
};

const createBulkPriorityUpdateFeature = ({
  state,
  getQueues,
  queryOpenQueueInteractions,
  updateConversationPriorities,
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

    return renderGuxFieldCheckbox({
      escapeHtml,
      className: INTERACTION_CHECKBOX_CLASS,
      label: "",
      checked: Boolean(exportMeta.selectedInteractionsById?.[conversationId]),
      attrs: `data-result-id="${escapeHtml(exportMeta.resultId)}" data-conversation-id="${escapeHtml(conversationId)}"`,
      labelPosition: "screenreader",
    });
  };

  const renderBulkPriorityBody = (resultId, exportMeta) => {
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
  <gux-button class="bulk-priority-apply" type="button" accent="primary" data-result-id="${escapeHtml(
    resultId
  )}">Update Selected Priorities</gux-button>
  <span class="muted bulk-selection-summary">${selectedCount} interaction(s) selected</span>
</div>`;
  };

  const readSetupFromDom = (resultEl, exportMeta) => {
    const queueControl = resultEl.querySelector(".bulk-priority-queue-select");
    const scopeControl = resultEl.querySelector(".bulk-priority-scope-select");
    const lookbackControl = resultEl.querySelector(".bulk-priority-lookback-input");
    const minDurationControl = resultEl.querySelector(".bulk-priority-min-duration-input");
    const startingControl = resultEl.querySelector(".bulk-priority-starting-input");

    exportMeta.queueId = queueControl ? String(queueControl.value || "").trim() : exportMeta.queueId;
    exportMeta.scope = scopeControl ? String(scopeControl.value || "all-open").trim() : exportMeta.scope;
    exportMeta.lookbackDays = lookbackControl ? String(lookbackControl.value || "7").trim() : exportMeta.lookbackDays;
    exportMeta.minDurationMinutes = minDurationControl
      ? String(minDurationControl.value || "0").trim()
      : exportMeta.minDurationMinutes;
    exportMeta.startingPriority = startingControl
      ? String(startingControl.value || "100").trim()
      : exportMeta.startingPriority;

    const checkedMediaTypes = Array.from(
      resultEl.querySelectorAll(".bulk-priority-media-type-checkbox:checked")
    )
      .map((input) => input.getAttribute("data-media-type"))
      .filter(Boolean);

    if (checkedMediaTypes.length > 0) {
      exportMeta.mediaTypes = checkedMediaTypes;
    }
  };

  const loadInteractions = async (resultId, exportMeta, { preserveSelection = false } = {}) => {
    const credentials = requireCredentials("Interaction Priority Updater");
    const resultEl = resultId ? document.getElementById(resultId) : null;
    if (!credentials || !resultEl || !exportMeta) {
      return;
    }

    readSetupFromDom(resultEl, exportMeta);

    if (!exportMeta.queueId) {
      prependExportResult(
        "Interaction Priority Updater",
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
        lookbackDays: Number(exportMeta.lookbackDays) || 7,
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

      const title = `Interaction Priority Updater - ${exportMeta.queueName}`;
      const status = `Loaded ${interactions.length} open interaction(s)`;
      const nextMeta = createBulkPrioritySelectionMeta({
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
        startingPriority: exportMeta.startingPriority,
        getCurrentAppDomain,
      });
      nextMeta.selectedInteractionsById = nextSelection;
      nextMeta.renderBody = () => renderBulkPriorityBody(resultId, state.exportData[resultId]);

      state.exportData[resultId] = nextMeta;
      finishExportResult(resultId, title, status, "", nextMeta);
    } catch (error) {
      finishExportResult(
        resultId,
        exportMeta.title || "Interaction Priority Updater",
        error.message || "Failed to load interactions",
        renderJsonBlock(error.payload || { error: error.message || "Failed to load interactions" })
      );
    }
  };

  const executePriorityUpdate = async (resultId, exportMeta, selectedInteractions, startingPriority) => {
    const resultEl = document.getElementById(resultId);
    const credentials = requireCredentials("Interaction Priority Updater");
    if (!resultEl || !exportMeta || !credentials) {
      return;
    }

    let priority = Number(startingPriority);
    if (!Number.isFinite(priority)) {
      priority = 100;
    }

    const updates = selectedInteractions.map((interaction) => {
      const entry = {
        conversationId: interaction.conversationId,
        priority,
      };
      priority -= 1;
      return entry;
    });

    resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
      `Updating priority for ${selectedInteractions.length} interaction(s)...`
    );

    try {
      const results = await updateConversationPriorities({ ...credentials, updates });

      const resultRows = updates.map((update, index) => {
        const interaction = selectedInteractions[index];
        const updateResult = results.find((entry) => entry.id === update.conversationId);
        return {
          conversationId: update.conversationId,
          priority: update.priority,
          startTime: interaction?.startTime || "",
          mediaType: interaction?.mediaType || "",
          status: updateResult?.status || "unknown",
          error: updateResult?.error || "",
        };
      });
      const status = summarizeBulkStatuses(resultRows);

      finishExportResult(
        resultId,
        "Interaction Priority Updater",
        status,
        "",
        createBulkPriorityResultsMeta(resultId, resultRows, "Interaction Priority Updater", status)
      );
    } catch (error) {
      finishExportResult(
        resultId,
        "Interaction Priority Updater",
        error.message || "Priority update failed",
        renderJsonBlock(error.payload || { error: error.message || "Priority update failed" })
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

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-priority-select-all")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return true;
      }

      exportMeta.selectedInteractionsById = { ...(exportMeta.selectedInteractionsById || {}) };
      (exportMeta.rows || []).forEach((interaction) => {
        if (target.checked) {
          exportMeta.selectedInteractionsById[interaction.conversationId] = interaction;
        } else {
          delete exportMeta.selectedInteractionsById[interaction.conversationId];
        }
      });

      refreshSelectionUi(resultId, exportMeta);
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

      const credentials = requireCredentials("Interaction Priority Updater");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Interaction Priority Updater",
        "Loading bulk action data...",
        renderLoadingState("Fetching queues...")
      );

      try {
        const queues = await getQueues(credentials);
        const queueOptions = queues
          .slice()
          .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")))
          .map((queue) => ({ value: queue.id, label: queue.name || queue.id }));

        const exportMeta = createBulkPrioritySelectionMeta({
          resultId: loadingResultId,
          title: "Interaction Priority Updater",
          status: `Loaded ${queueOptions.length} queue(s)`,
          rows: [],
          queueOptions,
          queueId: "",
          queueName: "",
          scope: "all-open",
          lookbackDays: 7,
          minDurationMinutes: 0,
          mediaTypes: DEFAULT_MEDIA_TYPES,
          startingPriority: 100,
          getCurrentAppDomain,
        });
        exportMeta.renderBody = () => renderBulkPriorityBody(loadingResultId, state.exportData[loadingResultId]);

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Interaction Priority Updater",
          error.message || "Priority updater load failed",
          renderJsonBlock(error.payload || { error: error.message || "Priority updater load failed" })
        );
      }
    });
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const loadButton = target.closest(".bulk-priority-load");
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

    const refreshButton = target.closest(".bulk-priority-refresh");
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

    const applyButton = target.closest(".bulk-priority-apply");
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

    const resultEl = document.getElementById(resultId);
    if (resultEl) {
      readSetupFromDom(resultEl, exportMeta);
    }

    const selectedInteractions = getSelectedInteractions(exportMeta);
    if (selectedInteractions.length === 0) {
      prependExportResult(
        "Interaction Priority Updater",
        "No interactions selected",
        '<p class="muted">Select at least one interaction before updating priorities.</p>'
      );
      return true;
    }

    const startingPriority = Number(exportMeta.startingPriority);
    if (!Number.isFinite(startingPriority)) {
      prependExportResult(
        "Interaction Priority Updater",
        "Invalid starting priority",
        '<p class="muted">Enter a valid starting priority value.</p>'
      );
      return true;
    }

    const priorityPreview = selectedInteractions
      .slice(0, 10)
      .map((interaction, index) => `<li><code>${escapeHtml(interaction.conversationId)}</code> → priority ${startingPriority - index}</li>`)
      .join("");

    confirmModal.open({
      resultId,
      title: "Confirm Priority Update",
      bodyHtml: `<div class="bulk-confirm-body">
        <p>Update priority for <strong>${escapeHtml(selectedInteractions.length)}</strong> interaction(s), starting at <strong>${escapeHtml(
          startingPriority
        )}</strong> and decrementing by 1 for each subsequent interaction.</p>
        <ul>${priorityPreview}</ul>
        ${
          selectedInteractions.length > 10
            ? `<p class="muted">And ${escapeHtml(selectedInteractions.length - 10)} more interaction(s) not shown.</p>`
            : ""
        }
      </div>`,
      confirmLabel: "Update Priorities",
      onConfirm: async ({ resultId: confirmedResultId, close }) => {
        const confirmedMeta = confirmedResultId ? state.exportData[confirmedResultId] : null;
        if (!confirmedMeta) {
          close();
          return;
        }
        close();
        await executePriorityUpdate(confirmedResultId, confirmedMeta, selectedInteractions, startingPriority);
      },
    });
    return true;
  };

  const handleChange = (event) => {
    if (handleInteractionSelectionChange(event)) {
      return true;
    }

    const queueChange = resolveDropdownChange(event.target, "bulk-priority-queue-select");
    if (queueChange) {
      const exportMeta = queueChange.resultId ? state.exportData[queueChange.resultId] : null;
      if (exportMeta) {
        exportMeta.queueId = queueChange.value;
        const selectedQueue = (exportMeta.queueOptions || []).find((option) => option.value === queueChange.value);
        exportMeta.queueName = selectedQueue?.label || queueChange.value;
      }
      return true;
    }

    const scopeChange = resolveDropdownChange(event.target, "bulk-priority-scope-select");
    if (scopeChange) {
      const exportMeta = scopeChange.resultId ? state.exportData[scopeChange.resultId] : null;
      if (exportMeta) {
        exportMeta.scope = scopeChange.value || "all-open";
      }
      return true;
    }

    const target = event.target;
    if (target instanceof HTMLInputElement && target.classList.contains("bulk-priority-media-type-checkbox")) {
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

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-priority-starting-input")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (exportMeta) {
        exportMeta.startingPriority = target.value;
      }
      return true;
    }

    return false;
  };

  return { wireButton, handleClick, handleChange };
};

export { createBulkPriorityUpdateFeature };
