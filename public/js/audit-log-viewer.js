import {
  renderGuxFieldSelect,
  renderGuxFieldText,
  renderGuxFieldTextarea,
  renderGuxTableToolbar,
  resolveDropdownChange,
  readControlValue,
} from "./gux-ui.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const ALL_ENTITY_TYPES = "__all_entity_types__";
const ALL_ACTIONS = "__all_actions__";

const normalizeEntityTypeValue = (value) => (value === ALL_ENTITY_TYPES ? "" : String(value || "").trim());
const normalizeActionValue = (value) => (value === ALL_ACTIONS ? "" : String(value || "").trim());
const toEntityTypeSelectValue = (value) => (value ? String(value) : ALL_ENTITY_TYPES);
const toActionSelectValue = (value) => (value ? String(value) : ALL_ACTIONS);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pad = (part) => String(part).padStart(2, "0");

const toDateTimeLocalValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;

const getDefaultDateRange = () => {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return {
    startValue: toDateTimeLocalValue(start),
    endValue: toDateTimeLocalValue(end),
  };
};

const buildAuditInterval = (startLocal, endLocal) => {
  const start = new Date(startLocal);
  const end = new Date(endLocal);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Enter a valid start and end date/time.");
  }

  if (start >= end) {
    throw new Error("Start time must be before end time.");
  }

  const formatUtc = (date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");
  return `${formatUtc(start)}/${formatUtc(end)}`;
};

const normalizeServiceMapping = (serviceMapping) => {
  const services = Array.isArray(serviceMapping?.services) ? serviceMapping.services : [];

  return services
    .map((service) => {
      const serviceName = service?.serviceName || service?.name || "";
      const entities = Array.isArray(service?.entities) ? service.entities : [];

      return {
        serviceName,
        entities: entities
          .map((entity) => ({
            entityType: entity?.entityType || entity?.name || "",
            actions: Array.isArray(entity?.actions) ? entity.actions.filter(Boolean) : [],
          }))
          .filter((entity) => entity.entityType)
          .sort((left, right) => left.entityType.localeCompare(right.entityType)),
      };
    })
    .filter((service) => service.serviceName)
    .sort((left, right) => left.serviceName.localeCompare(right.serviceName));
};

const getServiceOptions = (services, selectedServiceName = "") =>
  services.map((service) => ({
    value: service.serviceName,
    label: service.serviceName,
    selected: service.serviceName === selectedServiceName,
  }));

const getEntityOptions = (services, selectedServiceName = "", selectedEntityType = "") => {
  const service = services.find((entry) => entry.serviceName === selectedServiceName);
  const entities = service?.entities || [];

  return entities.map((entity) => ({
    value: entity.entityType,
    label: entity.entityType,
    selected: entity.entityType === selectedEntityType,
  }));
};

const getActionOptions = (services, selectedServiceName = "", selectedEntityType = "", selectedAction = "") => {
  const service = services.find((entry) => entry.serviceName === selectedServiceName);
  const entity = service?.entities?.find((entry) => entry.entityType === selectedEntityType);
  const actions = entity?.actions || [];

  return actions.map((action) => ({
    value: action,
    label: action,
    selected: action === selectedAction,
  }));
};

const renderSelectOptions = (options, placeholder, placeholderValue = "") => {
  const placeholderOption = `<option value="${escapeHtml(placeholderValue)}">${escapeHtml(placeholder)}</option>`;
  const optionHtml = options
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}"${option.selected ? " selected" : ""}>${escapeHtml(
          option.label
        )}</option>`
    )
    .join("");

  return `${placeholderOption}${optionHtml}`;
};

const normalizeAuditEntity = (entity) => ({
  auditId: entity?.id || "",
  eventDate: entity?.eventDate || "",
  userId: entity?.user?.id || "",
  serviceName: entity?.serviceName || "",
  entityType: entity?.entityType || "",
  action: entity?.action || "",
  entityId: entity?.entity?.id || "",
  entityName: entity?.entity?.name || "",
  status: entity?.status || "",
  raw: entity,
});

const escapeCsv = (value) => {
  const stringValue = String(value == null ? "" : value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const buildAuditCsv = (rows) => {
  const headers = [
    "Event Date",
    "User ID",
    "Service",
    "Entity Type",
    "Action",
    "Entity ID",
    "Entity Name",
    "Status",
    "Audit ID",
  ];

  const lines = [headers.map(escapeCsv).join(",")];
  rows.forEach((row) => {
    lines.push(
      [
        row.eventDate,
        row.userId,
        row.serviceName,
        row.entityType,
        row.action,
        row.entityId,
        row.entityName,
        row.status,
        row.auditId,
      ]
        .map(escapeCsv)
        .join(",")
    );
  });

  return lines.join("\n");
};

const downloadAuditCsv = (rows, filename = "audit_log.csv") => {
  const blob = new Blob([buildAuditCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const createAuditLogViewerFeature = ({
  state,
  getAuditServiceMapping,
  createAuditQuery,
  getAuditQueryStatus,
  getAuditQueryResults,
  requireCredentials,
  startExportResult,
  finishExportResult,
  renderLoadingState,
  renderJsonBlock,
}) => {
  const readFormValues = (resultId, featureState = null) => {
    const resultEl = document.getElementById(resultId);
    if (!resultEl) {
      return null;
    }

    const readField = (className, fallback = "") => {
      if (resultEl.querySelector(`.${className}`)) {
        return String(readControlValue(resultEl, className)).trim();
      }
      return fallback;
    };

    return {
      startValue: readField("audit-log-start", featureState?.startValue || ""),
      endValue: readField("audit-log-end", featureState?.endValue || ""),
      serviceName: readField("audit-log-service-select", featureState?.selectedServiceName || ""),
      entityType: normalizeEntityTypeValue(
        readField("audit-log-entity-select", featureState?.selectedEntityType || "")
      ),
      action: normalizeActionValue(readField("audit-log-action-select", featureState?.selectedAction || "")),
    };
  };

  const buildQueryPayload = (formValues) => {
    if (!formValues?.serviceName) {
      throw new Error("Select a service before running the audit query.");
    }

    const filters = [];
    if (formValues.entityType) {
      filters.push({ property: "EntityType", value: formValues.entityType });
    }
    if (formValues.action) {
      if (!formValues.entityType) {
        throw new Error("Select an entity type when filtering by action.");
      }
      filters.push({ property: "Action", value: formValues.action });
    }

    return {
      interval: buildAuditInterval(formValues.startValue, formValues.endValue),
      serviceName: formValues.serviceName,
      filters,
      sort: [{ name: "Timestamp", sortOrder: "descending" }],
    };
  };

  const renderSetup = (resultId, featureState) => {
    const services = featureState.services || [];
    const selectedServiceName = featureState.selectedServiceName || "";
    const selectedEntityType = featureState.selectedEntityType || "";
    const selectedAction = featureState.selectedAction || "";
    const defaults = getDefaultDateRange();

    return `<div class="column-editor">
      <div class="column-editor__header">Audit Log Viewer</div>
      <div class="sidebar-actions audit-log-form">
        <div class="audit-log-form__row audit-log-form__row--datetime">
          ${renderGuxFieldText({
            escapeHtml,
            inputId: `${resultId}-audit-log-start`,
            className: "audit-log-start",
            label: "Start (local time)",
            value: featureState.startValue || defaults.startValue,
            type: "datetime-local",
            clearable: false,
            attrs: `data-result-id="${escapeHtml(resultId)}"`,
          })}
          ${renderGuxFieldText({
            escapeHtml,
            inputId: `${resultId}-audit-log-end`,
            className: "audit-log-end",
            label: "End (local time)",
            value: featureState.endValue || defaults.endValue,
            type: "datetime-local",
            clearable: false,
            attrs: `data-result-id="${escapeHtml(resultId)}"`,
          })}
        </div>
        <div class="audit-log-form__row audit-log-form__row--filters">
          ${renderGuxFieldSelect({
            escapeHtml,
            inputId: `${resultId}-audit-log-service`,
            className: "audit-log-service-select",
            label: "Service",
            value: selectedServiceName,
            optionsHtml: renderSelectOptions(getServiceOptions(services, selectedServiceName), "Select service"),
            attrs: `data-result-id="${escapeHtml(resultId)}"`,
          })}
          ${renderGuxFieldSelect({
            escapeHtml,
            inputId: `${resultId}-audit-log-entity`,
            className: "audit-log-entity-select",
            label: "Entity Type",
            value: selectedServiceName ? toEntityTypeSelectValue(selectedEntityType) : "",
            optionsHtml: renderSelectOptions(
              getEntityOptions(services, selectedServiceName, selectedEntityType),
              selectedServiceName ? "All entity types" : "Select service first",
              selectedServiceName ? ALL_ENTITY_TYPES : ""
            ),
            attrs: `data-result-id="${escapeHtml(resultId)}"`,
          })}
          ${renderGuxFieldSelect({
            escapeHtml,
            inputId: `${resultId}-audit-log-action`,
            className: "audit-log-action-select",
            label: "Action",
            value: selectedEntityType ? toActionSelectValue(selectedAction) : "",
            optionsHtml: renderSelectOptions(
              getActionOptions(services, selectedServiceName, selectedEntityType, selectedAction),
              selectedServiceName
                ? selectedEntityType
                  ? "All actions"
                  : "Select entity type to filter by action"
                : "Select service first",
              selectedEntityType ? ALL_ACTIONS : ""
            ),
            attrs: `data-result-id="${escapeHtml(resultId)}"`,
          })}
        </div>
        <div class="audit-log-form__actions">
          <gux-button class="audit-log-run" type="button" accent="primary" data-result-id="${escapeHtml(
            resultId
          )}">Run Audit Query</gux-button>
        </div>
      </div>
    </div>`;
  };

  const renderCompletionBanner = (featureState) => {
    if (!featureState.queryCompleted) {
      return "";
    }

    const rowCount = featureState.rows?.length || 0;
    const detail =
      featureState.resultsStatus ||
      `Found ${rowCount} audit event${rowCount === 1 ? "" : "s"} for this query.`;

    return `<gux-form-field-text-like class="audit-log-complete-banner" label-position="above" role="status" aria-live="polite">
      <input slot="input" type="text" readonly class="audit-log-complete-banner__detail" value="${escapeHtml(detail)}" />
      <label slot="label" class="audit-log-complete-banner__title">Search Complete</label>
    </gux-form-field-text-like>`;
  };

  const renderAuditResults = (resultId, featureState) => {
    const rows = featureState.rows || [];
    const expandedIds = featureState.expandedIds || {};
    const statusMessage = featureState.resultsStatus || "";
    const cursor = featureState.nextCursor || "";
    const completionBanner = renderCompletionBanner(featureState);

    if (!rows.length) {
      return `<div class="audit-log-results">
        ${completionBanner}
        <gux-table class="audit-log-table" compact="true" empty-message="No audit events matched this query.">
          <table slot="data">
            <thead>
              <tr>
                <th></th>
                <th>Event Date</th>
                <th>User ID</th>
                <th>Service</th>
                <th>Entity Type</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </gux-table>
      </div>`;
    }

    const renderExpandButton = (row, isExpanded) =>
      `<gux-button class="audit-log-expand" type="button" accent="secondary" size="small" data-result-id="${escapeHtml(
        resultId
      )}" data-audit-id="${escapeHtml(row.auditId)}" aria-expanded="${isExpanded ? "true" : "false"}" aria-label="${
        isExpanded ? "Collapse audit details" : "Expand audit details"
      }">
        <gux-icon
          slot="icon"
          icon-name="${isExpanded ? "custom/chevron-down-small-regular" : "custom/chevron-right-small-regular"}"
          decorative="true"
          size="small"
        ></gux-icon>
      </gux-button>`;

    const tableRows = rows
      .map((row) => {
        const isExpanded = Boolean(expandedIds[row.auditId]);
        const json = JSON.stringify(row.raw, null, 2);

        return `<tr class="audit-log-row" data-audit-id="${escapeHtml(row.auditId)}">
          <td>${renderExpandButton(row, isExpanded)}</td>
          <td>${escapeHtml(row.eventDate)}</td>
          <td>${escapeHtml(row.userId)}</td>
          <td>${escapeHtml(row.serviceName)}</td>
          <td>${escapeHtml(row.entityType)}</td>
          <td>${escapeHtml(row.action)}</td>
          <td>${escapeHtml(row.entityName || row.entityId)}</td>
          <td>${escapeHtml(row.status)}</td>
        </tr>
        <tr class="audit-log-detail-row${isExpanded ? " is-open" : ""}" data-audit-id="${escapeHtml(row.auditId)}"${
          isExpanded ? "" : " hidden"
        }>
          <td colspan="8">
            ${renderGuxFieldTextarea({
              escapeHtml,
              inputId: `${resultId}-audit-json-${row.auditId}`,
              className: "audit-log-json",
              label: "Raw JSON",
              value: json,
              rows: 12,
              attrs: 'readonly="readonly"',
            })}
          </td>
        </tr>`;
      })
      .join("");

    const toolbarHtml = renderGuxTableToolbar({
      escapeHtml,
      className: "audit-log-toolbar",
      searchAndFilterHtml: `<span class="audit-log-toolbar__status">${escapeHtml(statusMessage)}</span>`,
      permanentActionsHtml: `<gux-button class="audit-log-download-csv" type="button" accent="secondary" data-result-id="${escapeHtml(
        resultId
      )}">Download CSV</gux-button>${
        cursor
          ? `<gux-button class="audit-log-load-more" type="button" accent="secondary" data-result-id="${escapeHtml(
              resultId
            )}">Load More</gux-button>`
          : ""
      }`,
    });

    return `<div class="audit-log-results">
      ${completionBanner}
      ${toolbarHtml}
      <div class="gux-table-shell">
        <gux-table class="audit-log-table" compact="true">
          <table slot="data">
            <thead>
              <tr>
                <th></th>
                <th>Event Date</th>
                <th>User ID</th>
                <th>Service</th>
                <th>Entity Type</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </gux-table>
      </div>
    </div>`;
  };

  const rerenderFeature = (resultId) => {
    const exportMeta = state.exportData[resultId];
    const resultEl = document.getElementById(resultId);
    if (!exportMeta || !resultEl) {
      return;
    }

    const formValues = readFormValues(resultId, exportMeta);
    if (formValues) {
      exportMeta.startValue = formValues.startValue;
      exportMeta.endValue = formValues.endValue;
      exportMeta.selectedServiceName = formValues.serviceName;
      exportMeta.selectedEntityType = formValues.entityType;
      exportMeta.selectedAction = formValues.action;
    }

    const bodyEl = resultEl.querySelector(".export-results__body");
    if (!bodyEl) {
      return;
    }

    bodyEl.innerHTML = `${renderSetup(resultId, exportMeta)}${
      exportMeta.queryCompleted || exportMeta.rows ? renderAuditResults(resultId, exportMeta) : ""
    }`;
  };

  const pollAuditQuery = async ({ credentials, transactionId, onStatus, signal }) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (signal?.aborted) {
        throw new Error("Audit query cancelled.");
      }

      const status = await getAuditQueryStatus({ ...credentials, transactionId });
      onStatus?.(status);

      const stateName = String(status?.state || "").toUpperCase();
      if (stateName === "SUCCEEDED") {
        return status;
      }

      if (stateName === "FAILED" || stateName === "CANCELLED") {
        throw new Error(status?.error || `Audit query ${stateName.toLowerCase()}.`);
      }

      await wait(2000);
    }

    throw new Error("Timed out waiting for audit query results.");
  };

  const loadAuditResults = async ({ credentials, transactionId, cursor = "" }) => {
    const resultsPayload = await getAuditQueryResults({ ...credentials, transactionId, cursor });
    const entities = Array.isArray(resultsPayload?.entities) ? resultsPayload.entities : [];
    const nextUri = resultsPayload?.nextUri || "";
    let nextCursor = "";

    if (nextUri) {
      nextCursor = resultsPayload?.cursor || "";
      if (!nextCursor) {
        try {
          const parsed = new URL(nextUri, "https://api.example.com");
          nextCursor = parsed.searchParams.get("cursor") || "";
        } catch (_error) {
          nextCursor = "";
        }
      }
    }

    return {
      rows: entities.map(normalizeAuditEntity),
      nextCursor,
    };
  };

  const runAuditQuery = async (resultId, featureState) => {
    const credentials = requireCredentials("Audit Log Viewer");
    const resultEl = document.getElementById(resultId);
    if (!credentials || !resultEl) {
      return;
    }

    const formValues = readFormValues(resultId, featureState);
    let queryPayload;

    try {
      queryPayload = buildQueryPayload(formValues);
    } catch (error) {
      finishExportResult(
        resultId,
        "Audit Log Viewer",
        error.message,
        `<p class="muted">${escapeHtml(error.message)}</p>`,
        {
          ...featureState,
          resultId,
          title: "Audit Log Viewer",
          status: error.message,
          renderBody: () => renderSetup(resultId, state.exportData[resultId] || featureState),
        }
      );
      return;
    }

    const controller = new AbortController();
    featureState.activeQueryController?.abort();
    featureState.activeQueryController = controller;

    Object.assign(featureState, {
      startValue: formValues.startValue,
      endValue: formValues.endValue,
      selectedServiceName: formValues.serviceName,
      selectedEntityType: formValues.entityType,
      selectedAction: formValues.action,
      rows: [],
      expandedIds: {},
      nextCursor: "",
      transactionId: "",
      resultsStatus: "",
      queryCompleted: false,
    });

    resultEl.querySelector(".export-results__body").innerHTML = `${renderSetup(
      resultId,
      featureState
    )}${renderLoadingState("Submitting audit query...")}`;

    try {
      const submission = await createAuditQuery({ ...credentials, query: queryPayload });
      const transactionId = submission?.id || submission?.transactionId || "";

      if (!transactionId) {
        throw new Error("Audit query did not return a transaction ID.");
      }

      featureState.transactionId = transactionId;

      const updateWaitingMessage = (status) => {
        const bodyEl = resultEl.querySelector(".export-results__body");
        if (!bodyEl) {
          return;
        }

        const stateLabel = status?.state || "Running";
        bodyEl.innerHTML = `${renderSetup(resultId, featureState)}${renderLoadingState(
          `Waiting for audit results... (${stateLabel})`
        )}`;
      };

      await pollAuditQuery({
        credentials,
        transactionId,
        signal: controller.signal,
        onStatus: updateWaitingMessage,
      });

      const { rows, nextCursor } = await loadAuditResults({ credentials, transactionId });
      featureState.rows = rows;
      featureState.nextCursor = nextCursor;
      featureState.queryCompleted = true;
      featureState.resultsStatus = `Found ${rows.length} audit event${rows.length === 1 ? "" : "s"} for this query.`;
      featureState.renderBody = () =>
        `${renderSetup(resultId, featureState)}${renderAuditResults(resultId, featureState)}`;

      finishExportResult(resultId, "Audit Log Viewer", "Search complete", "", featureState);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      finishExportResult(
        resultId,
        "Audit Log Viewer",
        error.message || "Audit query failed",
        `${renderSetup(resultId, featureState)}${renderJsonBlock(error.payload || { error: error.message || "Audit query failed" })}`,
        {
          ...featureState,
          resultId,
          title: "Audit Log Viewer",
          status: error.message || "Audit query failed",
          renderBody: () =>
            `${renderSetup(resultId, featureState)}${renderJsonBlock(error.payload || { error: error.message || "Audit query failed" })}`,
        }
      );
    } finally {
      if (featureState.activeQueryController === controller) {
        featureState.activeQueryController = null;
      }
    }
  };

  const loadMoreResults = async (resultId, featureState) => {
    const credentials = requireCredentials("Audit Log Viewer");
    if (!credentials || !featureState.transactionId || !featureState.nextCursor) {
      return;
    }

    const resultEl = document.getElementById(resultId);
    if (!resultEl) {
      return;
    }

    const loadMoreButton = resultEl.querySelector(".audit-log-load-more");
    if (loadMoreButton instanceof HTMLElement) {
      loadMoreButton.setAttribute("disabled", "true");
    }

    try {
      const { rows, nextCursor } = await loadAuditResults({
        credentials,
        transactionId: featureState.transactionId,
        cursor: featureState.nextCursor,
      });

      featureState.rows = [...(featureState.rows || []), ...rows];
      featureState.nextCursor = nextCursor;
      featureState.resultsStatus = `Found ${featureState.rows.length} audit event${
        featureState.rows.length === 1 ? "" : "s"
      } for this query.`;
      rerenderFeature(resultId);
    } catch (error) {
      featureState.resultsStatus = error.message || "Failed to load more audit results.";
      rerenderFeature(resultId);
    }
  };

  const handleDropdownChange = (event) => {
    const serviceChange = resolveDropdownChange(event.target, "audit-log-service-select");
    if (serviceChange) {
      const exportMeta = state.exportData[serviceChange.resultId];
      if (!exportMeta) {
        return true;
      }

      exportMeta.selectedServiceName = serviceChange.value;
      exportMeta.selectedEntityType = "";
      exportMeta.selectedAction = "";
      rerenderFeature(serviceChange.resultId);
      return true;
    }

    const entityChange = resolveDropdownChange(event.target, "audit-log-entity-select");
    if (entityChange) {
      const exportMeta = state.exportData[entityChange.resultId];
      if (!exportMeta) {
        return true;
      }

      exportMeta.selectedEntityType = normalizeEntityTypeValue(entityChange.value);
      exportMeta.selectedAction = "";
      rerenderFeature(entityChange.resultId);
      return true;
    }

    const actionChange = resolveDropdownChange(event.target, "audit-log-action-select");
    if (actionChange) {
      const exportMeta = state.exportData[actionChange.resultId];
      if (!exportMeta) {
        return true;
      }

      exportMeta.selectedAction = normalizeActionValue(actionChange.value);
      rerenderFeature(actionChange.resultId);
      return true;
    }

    return false;
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const runButton = target.closest(".audit-log-run");
    if (runButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = runButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return true;
      }

      await runAuditQuery(resultId, exportMeta);
      return true;
    }

    const loadMoreButton = target.closest(".audit-log-load-more");
    if (loadMoreButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = loadMoreButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return true;
      }

      await loadMoreResults(resultId, exportMeta);
      return true;
    }

    const downloadButton = target.closest(".audit-log-download-csv");
    if (downloadButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = downloadButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!exportMeta?.rows?.length) {
        return true;
      }

      downloadAuditCsv(exportMeta.rows, `audit_log_${Date.now()}.csv`);
      return true;
    }

    const expandButton = target.closest(".audit-log-expand");
    if (expandButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = expandButton.getAttribute("data-result-id");
      const auditId = expandButton.getAttribute("data-audit-id") || "";
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta || !auditId) {
        return true;
      }

      exportMeta.expandedIds = exportMeta.expandedIds || {};
      exportMeta.expandedIds[auditId] = !exportMeta.expandedIds[auditId];
      rerenderFeature(resultId);
      return true;
    }

    return false;
  };

  const wireButton = (button) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!state.hasConnection) {
        return;
      }

      const credentials = requireCredentials("Audit Log Viewer");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Audit Log Viewer",
        "Loading service mapping...",
        renderLoadingState('Fetching "/api/v2/audits/query/servicemapping"...')
      );

      try {
        const serviceMapping = await getAuditServiceMapping(credentials);
        const services = normalizeServiceMapping(serviceMapping);
        const defaults = getDefaultDateRange();
        const exportMeta = {
          resultId: loadingResultId,
          title: "Audit Log Viewer",
          status: "Configure query and run",
          exportType: "audit_log_viewer",
          kind: "audit-log-viewer",
          hideActions: true,
          editable: false,
          services,
          selectedServiceName: "",
          selectedEntityType: "",
          selectedAction: "",
          startValue: defaults.startValue,
          endValue: defaults.endValue,
          rows: null,
          expandedIds: {},
          queryCompleted: false,
          renderBody: () => renderSetup(loadingResultId, state.exportData[loadingResultId] || exportMeta),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Audit Log Viewer",
          error.message || "Service mapping request failed",
          renderJsonBlock(error.payload || { error: error.message || "Service mapping request failed" })
        );
      }
    });
  };

  return {
    handleClick,
    handleChange: handleDropdownChange,
    wireButton,
  };
};

export { createAuditLogViewerFeature, normalizeServiceMapping };
