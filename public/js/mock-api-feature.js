import {
  activateMockApiEndpoint,
  archiveMockApiEndpoint,
  cloneMockApiEndpoint,
  createMockApiEndpoint,
  deleteMockApiEndpoint,
  fetchMockApiConfig,
  fetchMockApiContext,
  fetchMockApiEndpointLogs,
  fetchMockApiEndpoints,
  fetchMockApiLog,
  restoreMockApiEndpoint,
  updateMockApiEndpoint,
} from "./mock-api-client.js";
import {
  renderGuxFieldSelect,
  renderGuxFieldText,
  renderGuxFieldTextarea,
  renderGuxTable,
  renderGuxTableToolbar,
} from "./gux-ui.js";

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
  return new Date(value).toLocaleString();
};

const formatDelay = (delayMs) => {
  if (!delayMs) {
    return "Immediate";
  }
  if (delayMs < 1000) {
    return `${delayMs} ms`;
  }
  return `${delayMs / 1000} s`;
};

const renderJsonBlock = (value) =>
  `<pre class="mock-api-json-block">${escapeHtml(
    typeof value === "string" ? value : JSON.stringify(value, null, 2)
  )}</pre>`;

const parseHeadersText = (text) => {
  const headers = {};
  String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) {
        return;
      }
      const name = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (name) {
        headers[name] = value;
      }
    });
  return headers;
};

const stringifyHeaders = (headers = {}) =>
  Object.entries(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");

const defaultEndpointForm = () => ({
  endpointSlug: "",
  method: "POST",
  httpStatusCode: 200,
  responseContentType: "application/json",
  responseBody: '{\n  "ok": true\n}',
  responseHeadersText: "",
  delayMs: 0,
  activate: true,
});

const FIELD_INPUT_IDS = {
  endpointSlug: "mock-api-slug",
  method: "mock-api-method",
  httpStatusCode: "mock-api-status-code",
  responseContentType: "mock-api-content-type",
  delayMs: "mock-api-delay",
  responseBody: "mock-api-response-body",
  responseHeaders: "mock-api-response-headers",
};

const ERROR_FIELD_RULES = [
  { pattern: /endpoint slug|reserved endpoint|already exists/i, field: "endpointSlug" },
  { pattern: /HTTP status code/i, field: "httpStatusCode" },
  { pattern: /valid JSON|response body exceeds/i, field: "responseBody" },
  { pattern: /response headers|header name|Header "/i, field: "responseHeaders" },
  { pattern: /response delay|unsupported response delay|delay cannot exceed/i, field: "delayMs" },
  { pattern: /HTTP method/i, field: "method" },
  { pattern: /content type/i, field: "responseContentType" },
];

const mapValidationErrorToFields = (message) => {
  const normalizedMessage = String(message || "Validation failed.");
  const matchedRule = ERROR_FIELD_RULES.find((rule) => rule.pattern.test(normalizedMessage));
  if (matchedRule) {
    return { [matchedRule.field]: normalizedMessage };
  }
  return { _form: normalizedMessage };
};

const validateEndpointForm = (values, config) => {
  const slug = String(values.endpointSlug || "").trim();
  if (!slug) {
    return { message: "Endpoint slug is required.", fields: { endpointSlug: "Endpoint slug is required." } };
  }

  const statusCode = Number(values.httpStatusCode);
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    return {
      message: "HTTP status code must be between 100 and 599.",
      fields: { httpStatusCode: "HTTP status code must be between 100 and 599." },
    };
  }

  if (values.responseContentType === "application/json" && String(values.responseBody || "").trim()) {
    try {
      JSON.parse(values.responseBody);
    } catch {
      return {
        message: "Response body must be valid JSON for application/json.",
        fields: { responseBody: "Response body must be valid JSON for application/json." },
      };
    }
  }

  const allowedDelays = config?.allowedDelaysMs || [0];
  if (!allowedDelays.includes(Number(values.delayMs))) {
    return {
      message: "Unsupported response delay.",
      fields: { delayMs: "Unsupported response delay." },
    };
  }

  const headerLines = String(values.responseHeadersText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of headerLines) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      return {
        message: 'Response headers must use the format "Name: value".',
        fields: { responseHeaders: 'Each header line must use the format "Name: value".' },
      };
    }
  }

  return null;
};

const createMockApiFeature = ({
  state,
  requireCredentials,
  startExportResult,
  finishExportResult,
  renderLoadingState,
  renderJsonBlock: renderJsonBlockFn = renderJsonBlock,
  confirmModal,
}) => {
  let configCache = null;
  let contextCache = null;
  let featureState = {
    activeTab: "active",
    selectedEndpointId: "",
    selectedLogId: "",
    formMode: "",
    formValues: defaultEndpointForm(),
    formErrors: {},
    editingId: "",
    logs: [],
    selectedLog: null,
    endpoints: {
      active: [],
      expired: [],
      archived: [],
    },
  };

  const getCredentials = () => requireCredentials("Mock API");

  const loadConfig = async () => {
    if (!configCache) {
      configCache = await fetchMockApiConfig();
    }
    return configCache;
  };

  const loadContext = async (credentials) => {
    contextCache = await fetchMockApiContext(credentials);
    return contextCache;
  };

  const loadEndpoints = async (credentials) => {
    const [activePayload, expiredPayload, archivedPayload] = await Promise.all([
      fetchMockApiEndpoints({ ...credentials, group: "active" }),
      fetchMockApiEndpoints({ ...credentials, group: "expired" }),
      fetchMockApiEndpoints({ ...credentials, group: "archived" }),
    ]);
    featureState.endpoints = {
      active: activePayload.endpoints || [],
      expired: expiredPayload.endpoints || [],
      archived: archivedPayload.endpoints || [],
    };
  };

  const loadLogsForEndpoint = async (credentials, endpointId) => {
    if (!endpointId) {
      featureState.logs = [];
      featureState.selectedLog = null;
      return;
    }
    const payload = await fetchMockApiEndpointLogs({ ...credentials, id: endpointId, limit: 100 });
    featureState.logs = payload.logs || [];
    if (featureState.selectedLogId) {
      const selected = featureState.logs.find((entry) => entry.id === featureState.selectedLogId);
      featureState.selectedLog = selected || null;
    }
  };

  const renderStatusBadge = (status) =>
    `<span class="mock-api-status mock-api-status--${escapeHtml(status)}">${escapeHtml(status)}</span>`;

  const renderEndpointActions = (endpoint, { recoverable = false } = {}) => {
    const id = escapeHtml(endpoint.id);
    const actions = recoverable
      ? `<button type="button" class="mock-api-action" data-mock-api-action="restore" data-endpoint-id="${id}">Restore</button>
         <button type="button" class="mock-api-action" data-mock-api-action="clone" data-endpoint-id="${id}">Clone</button>
         <button type="button" class="mock-api-action mock-api-action--danger" data-mock-api-action="delete" data-endpoint-id="${id}">Delete</button>`
      : `<button type="button" class="mock-api-action" data-mock-api-action="edit" data-endpoint-id="${id}">Edit</button>
         <button type="button" class="mock-api-action" data-mock-api-action="clone" data-endpoint-id="${id}">Clone</button>
         <button type="button" class="mock-api-action" data-mock-api-action="archive" data-endpoint-id="${id}">Archive</button>
         <button type="button" class="mock-api-action mock-api-action--danger" data-mock-api-action="delete" data-endpoint-id="${id}">Delete</button>
         <button type="button" class="mock-api-action" data-mock-api-action="copy-url" data-endpoint-id="${id}">Copy URL</button>
         ${
           endpoint.status === "draft" || endpoint.status === "expired"
             ? `<button type="button" class="mock-api-action mock-api-action--primary" data-mock-api-action="activate" data-endpoint-id="${id}">Activate</button>`
             : ""
         }`;

    return `<div class="mock-api-actions">${actions}</div>`;
  };

  const renderEndpointTable = (endpoints, { recoverable = false } = {}) => {
    const columns = [
      { key: "endpointSlug", header: "Name" },
      { key: "method", header: "Method" },
      { key: "publicUrl", header: "URL" },
      { key: "status", header: "Status" },
      { key: "lastUsedAt", header: "Last Used" },
      { key: "expiresAt", header: "Expires" },
      { key: "hitCount", header: "Hits" },
      { key: "actions", header: "Actions" },
    ];

    return renderGuxTable({
      columns,
      rows: endpoints,
      escapeHtml,
      className: "mock-api-table",
      emptyMessage: recoverable ? "No expired or archived endpoints." : "No active mock endpoints yet.",
      renderCell: (column, row) => {
        switch (column.key) {
          case "endpointSlug":
            return `<button type="button" class="mock-api-link" data-mock-api-action="select-endpoint" data-endpoint-id="${escapeHtml(
              row.id
            )}">${escapeHtml(row.endpointSlug)}</button>`;
          case "publicUrl":
            return `<code class="mock-api-url">${escapeHtml(row.publicUrl || "")}</code>`;
          case "status":
            return renderStatusBadge(row.status);
          case "lastUsedAt":
            return escapeHtml(formatTimestamp(row.lastUsedAt));
          case "expiresAt":
            return escapeHtml(formatTimestamp(row.expiresAt));
          case "actions":
            return renderEndpointActions(row, { recoverable });
          default:
            return escapeHtml(row[column.key] ?? "");
        }
      },
    });
  };

  const renderLogList = () => {
    if (!featureState.selectedEndpointId) {
      return `<p class="mock-api-empty">Select an endpoint to view request history.</p>`;
    }

    if (!featureState.logs.length) {
      return `<p class="mock-api-empty">No requests logged for this endpoint yet.</p>`;
    }

    return `<div class="mock-api-log-list">${featureState.logs
      .map(
        (log) => `<button type="button" class="mock-api-log-item${
          featureState.selectedLogId === log.id ? " is-selected" : ""
        }" data-mock-api-action="select-log" data-log-id="${escapeHtml(log.id)}">
          <span class="mock-api-log-item__time">${escapeHtml(formatTimestamp(log.timestamp))}</span>
          <span class="mock-api-log-item__method">${escapeHtml(log.method)}</span>
          <span class="mock-api-log-item__path">${escapeHtml(log.path)}</span>
          <span class="mock-api-log-item__code">${escapeHtml(log.responseCode)}</span>
          <span class="mock-api-log-item__duration">${escapeHtml(log.responseTimeMs)} ms</span>
        </button>`
      )
      .join("")}</div>`;
  };

  const renderLogDetail = () => {
    const log = featureState.selectedLog;
    if (!log) {
      return `<p class="mock-api-empty">Select a request to inspect headers and bodies.</p>`;
    }

    return `<div class="mock-api-log-detail">
      <div class="mock-api-log-detail__meta">
        <div><strong>Timestamp:</strong> ${escapeHtml(formatTimestamp(log.timestamp))}</div>
        <div><strong>Method:</strong> ${escapeHtml(log.method)}</div>
        <div><strong>Path:</strong> ${escapeHtml(log.path)}</div>
        <div><strong>Query:</strong> ${escapeHtml(log.queryString || "—")}</div>
        <div><strong>Response:</strong> ${escapeHtml(log.responseCode)} (${escapeHtml(log.responseTimeMs)} ms)</div>
        <div><strong>IP:</strong> ${escapeHtml(log.requestIp || "—")}</div>
      </div>
      <h4>Request Headers</h4>
      ${renderJsonBlockFn(log.requestHeaders)}
      <h4>Request Body</h4>
      ${renderJsonBlockFn(log.requestBody || "")}
      <h4>Response Headers</h4>
      ${renderJsonBlockFn(log.responseHeaders)}
      <h4>Response Body</h4>
      ${renderJsonBlockFn(log.responseBody || "")}
    </div>`;
  };

  const renderFieldWrapper = (fieldKey, html) => {
    const message = featureState.formErrors[fieldKey];
    const errorClass = message ? " mock-api-field--error" : "";
    const errorHtml = message
      ? `<p class="mock-api-field-error" role="alert">${escapeHtml(message)}</p>`
      : "";

    return `<div class="mock-api-field${errorClass}" data-mock-api-field="${escapeHtml(fieldKey)}">${html}${errorHtml}</div>`;
  };

  const renderEndpointForm = (config) => {
    const statusOptions = (config?.httpStatusPresets || []).map((entry) => ({
      value: String(entry.code),
      label: entry.label,
      selected: Number(featureState.formValues.httpStatusCode) === entry.code,
    }));

    const methodOptions = (config?.allowedMethods || ["GET", "POST"]).map((method) => ({
      value: method,
      label: method,
      selected: featureState.formValues.method === method,
    }));

    const contentTypeOptions = (config?.allowedContentTypes || ["application/json"]).map((type) => ({
      value: type,
      label: type,
      selected: featureState.formValues.responseContentType === type,
    }));

    const delayOptions = (config?.allowedDelaysMs || [0]).map((delay) => ({
      value: String(delay),
      label: formatDelay(delay),
      selected: Number(featureState.formValues.delayMs) === delay,
    }));

    const customStatusValue =
      statusOptions.some((option) => option.selected) ? "" : String(featureState.formValues.httpStatusCode);

    return `<section class="mock-api-form">
      <h3>${featureState.formMode === "edit" ? "Edit Mock Endpoint" : "Create Mock Endpoint"}</h3>
      ${
        featureState.formErrors._form
          ? `<div class="mock-api-form-banner" role="alert">${escapeHtml(featureState.formErrors._form)}</div>`
          : ""
      }
      <div class="mock-api-form-grid">
        ${renderFieldWrapper(
          "endpointSlug",
          `${renderGuxFieldText({
            escapeHtml,
            inputId: "mock-api-slug",
            label: "Endpoint slug",
            value: featureState.formValues.endpointSlug,
            placeholder: "customer-create",
          })}
        ${
          contextCache?.publicUrlPrefix
            ? `<p class="mock-api-help">Public URL: <code>${escapeHtml(contextCache.publicUrlPrefix)}&lt;slug&gt;</code></p>`
            : ""
        }`
        )}
        ${renderFieldWrapper(
          "method",
          renderGuxFieldSelect({
            escapeHtml,
            inputId: "mock-api-method",
            label: "HTTP method",
            options: methodOptions,
          })
        )}
        ${renderFieldWrapper(
          "httpStatusCode",
          `${renderGuxFieldSelect({
            escapeHtml,
            inputId: "mock-api-status-preset",
            label: "HTTP status (common)",
            options: [{ value: "", label: "Custom status code" }, ...statusOptions],
          })}
        ${renderGuxFieldText({
          escapeHtml,
          inputId: "mock-api-status-code",
          label: "HTTP status code",
          value: customStatusValue || String(featureState.formValues.httpStatusCode),
          placeholder: "200",
        })}`
        )}
        ${renderFieldWrapper(
          "responseContentType",
          renderGuxFieldSelect({
            escapeHtml,
            inputId: "mock-api-content-type",
            label: "Response content type",
            options: contentTypeOptions,
          })
        )}
        ${renderFieldWrapper(
          "delayMs",
          renderGuxFieldSelect({
            escapeHtml,
            inputId: "mock-api-delay",
            label: "Response delay",
            options: delayOptions,
          })
        )}
        ${renderFieldWrapper(
          "responseBody",
          renderGuxFieldTextarea({
            escapeHtml,
            inputId: "mock-api-response-body",
            label: "Response body",
            value: featureState.formValues.responseBody,
            rows: 8,
          })
        )}
        ${renderFieldWrapper(
          "responseHeaders",
          renderGuxFieldTextarea({
            escapeHtml,
            inputId: "mock-api-response-headers",
            label: "Response headers (one per line: Name: value)",
            value: featureState.formValues.responseHeadersText,
            rows: 5,
          })
        )}
      </div>
      <div class="mock-api-form-actions">
        <label class="mock-api-checkbox">
          <input type="checkbox" id="mock-api-activate" ${featureState.formValues.activate ? "checked" : ""} />
          Activate immediately
        </label>
        <div class="mock-api-form-buttons">
          <button type="button" class="mock-api-action" data-mock-api-action="cancel-form">Cancel</button>
          <button type="button" class="mock-api-action mock-api-action--primary" data-mock-api-action="save-form">
            ${featureState.formMode === "edit" ? "Save Changes" : "Create Endpoint"}
          </button>
        </div>
      </div>
    </section>`;
  };

  const renderFeatureBody = (resultId, config) => {
    const recoverable = [...featureState.endpoints.expired, ...featureState.endpoints.archived];
    const tabs = [
      { id: "active", label: "Active Endpoints", count: featureState.endpoints.active.length },
      { id: "recoverable", label: "Expired / Archived", count: recoverable.length },
      { id: "history", label: "Request History", count: featureState.logs.length },
    ];

    return `<div class="mock-api-feature" data-result-id="${escapeHtml(resultId)}">
      <header class="mock-api-header">
        <div>
          <h2>Mock API</h2>
          <p class="mock-api-subtitle">Create reusable HTTP endpoints for Data Actions, Architect, and external integrations.</p>
          ${
            contextCache
              ? `<p class="mock-api-owner">Owner: <code>${escapeHtml(contextCache.ownerUserpart)}</code> (${escapeHtml(
                  contextCache.ownerEmail
                )})</p>`
              : ""
          }
        </div>
        ${renderGuxTableToolbar({
          className: "mock-api-toolbar",
          primaryActionHtml: `<gux-button slot="primary-action" accent="primary" data-mock-api-action="new-endpoint">Create Endpoint</gux-button>`,
        })}
      </header>

      <nav class="mock-api-tabs" aria-label="Mock API sections">
        ${tabs
          .map(
            (tab) => `<button type="button" class="mock-api-tab${
              featureState.activeTab === tab.id ? " is-active" : ""
            }" data-mock-api-tab="${escapeHtml(tab.id)}">${escapeHtml(tab.label)} (${tab.count})</button>`
          )
          .join("")}
      </nav>

      ${
        featureState.formMode
          ? renderEndpointForm(config)
          : featureState.activeTab === "active"
            ? renderEndpointTable(featureState.endpoints.active)
            : featureState.activeTab === "recoverable"
              ? renderEndpointTable(recoverable, { recoverable: true })
              : `<div class="mock-api-history-layout">
                  <aside class="mock-api-history-list">${renderLogList()}</aside>
                  <section class="mock-api-history-detail">${renderLogDetail()}</section>
                </div>`
      }
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

  const readFormValues = () => {
    const slugInput = document.getElementById("mock-api-slug");
    const methodSelect = document.getElementById("mock-api-method");
    const statusPresetSelect = document.getElementById("mock-api-status-preset");
    const statusCodeInput = document.getElementById("mock-api-status-code");
    const contentTypeSelect = document.getElementById("mock-api-content-type");
    const delaySelect = document.getElementById("mock-api-delay");
    const bodyTextarea = document.getElementById("mock-api-response-body");
    const headersTextarea = document.getElementById("mock-api-response-headers");
    const activateCheckbox = document.getElementById("mock-api-activate");

    const presetStatus = statusPresetSelect?.value;
    const statusCode = presetStatus ? Number(presetStatus) : Number(statusCodeInput?.value || 200);

    return {
      endpointSlug: slugInput?.value || "",
      method: methodSelect?.value || "POST",
      httpStatusCode: statusCode,
      responseContentType: contentTypeSelect?.value || "application/json",
      responseBody: bodyTextarea?.value || "",
      responseHeadersText: headersTextarea?.value || "",
      delayMs: Number(delaySelect?.value || 0),
      activate: Boolean(activateCheckbox?.checked),
    };
  };

  const showValidationErrorModal = (message) => {
    if (!confirmModal) {
      return;
    }

    confirmModal.open({
      title: "Validation Error",
      bodyHtml: `<p>${escapeHtml(message)}</p>`,
      confirmLabel: "OK",
      cancelLabel: "Close",
      onConfirm: ({ close }) => close(),
    });
  };

  const focusFirstErrorField = () => {
    const firstKey = Object.keys(featureState.formErrors).find((key) => key !== "_form");
    if (!firstKey) {
      return;
    }

    const inputId = FIELD_INPUT_IDS[firstKey];
    const input = inputId ? document.getElementById(inputId) : null;
    input?.focus?.();
    input?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  };

  const showFormValidationErrors = (resultId, message, fields = {}) => {
    featureState.formErrors = fields;
    rerenderFeature(resultId);
    showValidationErrorModal(message);
    focusFirstErrorField();
  };

  const openCreateForm = () => {
    featureState.formMode = "create";
    featureState.editingId = "";
    featureState.formValues = defaultEndpointForm();
    featureState.formErrors = {};
  };

  const openEditForm = (endpoint) => {
    featureState.formMode = "edit";
    featureState.editingId = endpoint.id;
    featureState.formValues = {
      endpointSlug: endpoint.endpointSlug,
      method: endpoint.method,
      httpStatusCode: endpoint.httpStatusCode,
      responseContentType: endpoint.responseContentType,
      responseBody: endpoint.responseBody,
      responseHeadersText: stringifyHeaders(endpoint.responseHeaders),
      delayMs: endpoint.delayMs,
      activate: endpoint.status === "active",
    };
    featureState.formErrors = {};
  };

  const refreshFeature = async (resultId) => {
    const credentials = getCredentials();
    if (!credentials) {
      return;
    }

    await loadConfig();
    await loadContext(credentials);
    await loadEndpoints(credentials);
    await loadLogsForEndpoint(credentials, featureState.selectedEndpointId);
    rerenderFeature(resultId);
  };

  const saveForm = async (resultId) => {
    const credentials = getCredentials();
    if (!credentials) {
      return;
    }

    await loadConfig();
    featureState.formValues = readFormValues();
    featureState.formErrors = {};

    const clientValidation = validateEndpointForm(featureState.formValues, configCache);
    if (clientValidation) {
      showFormValidationErrors(resultId, clientValidation.message, clientValidation.fields);
      return;
    }

    const values = featureState.formValues;
    const payload = {
      endpointSlug: values.endpointSlug,
      method: values.method,
      httpStatusCode: values.httpStatusCode,
      responseContentType: values.responseContentType,
      responseBody: values.responseBody,
      responseHeaders: parseHeadersText(values.responseHeadersText),
      delayMs: values.delayMs,
      activate: values.activate,
    };

    try {
      if (featureState.formMode === "edit") {
        await updateMockApiEndpoint({ ...credentials, id: featureState.editingId, payload });
        if (values.activate) {
          await activateMockApiEndpoint({ ...credentials, id: featureState.editingId });
        }
      } else {
        await createMockApiEndpoint({ ...credentials, payload });
      }
    } catch (error) {
      const message = error.message || "Failed to save mock endpoint.";
      showFormValidationErrors(resultId, message, mapValidationErrorToFields(message));
      return;
    }

    featureState.formMode = "";
    featureState.editingId = "";
    featureState.formErrors = {};
    await refreshFeature(resultId);
  };

  const findEndpoint = (endpointId) =>
    [
      ...featureState.endpoints.active,
      ...featureState.endpoints.expired,
      ...featureState.endpoints.archived,
    ].find((entry) => entry.id === endpointId);

  const handleClick = async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return false;
    }

    const tabButton = target.closest("[data-mock-api-tab]");
    if (tabButton) {
      event.preventDefault();
      event.stopPropagation();
      featureState.activeTab = tabButton.getAttribute("data-mock-api-tab") || "active";
      const resultId = tabButton.closest("[data-result-id]")?.getAttribute("data-result-id");
      if (resultId) {
        rerenderFeature(resultId);
      }
      return true;
    }

    const actionButton = target.closest("[data-mock-api-action]");
    if (!actionButton) {
      return false;
    }

    const resultId = actionButton.closest("[data-result-id]")?.getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    if (!resultId || !exportMeta) {
      return false;
    }

    const action = actionButton.getAttribute("data-mock-api-action");
    const endpointId = actionButton.getAttribute("data-endpoint-id") || "";
    const logId = actionButton.getAttribute("data-log-id") || "";
    const credentials = getCredentials();
    if (!credentials) {
      return true;
    }

    event.preventDefault();
    event.stopPropagation();

    try {
      if (action === "new-endpoint") {
        openCreateForm();
        rerenderFeature(resultId);
        return true;
      }

      if (action === "cancel-form") {
        featureState.formMode = "";
        featureState.editingId = "";
        featureState.formErrors = {};
        rerenderFeature(resultId);
        return true;
      }

      if (action === "save-form") {
        await saveForm(resultId);
        return true;
      }

      if (action === "select-endpoint") {
        featureState.selectedEndpointId = endpointId;
        featureState.activeTab = "history";
        featureState.selectedLogId = "";
        featureState.selectedLog = null;
        await loadLogsForEndpoint(credentials, endpointId);
        rerenderFeature(resultId);
        return true;
      }

      if (action === "select-log") {
        featureState.selectedLogId = logId;
        const cached = featureState.logs.find((entry) => entry.id === logId);
        if (cached) {
          featureState.selectedLog = cached;
        } else {
          const payload = await fetchMockApiLog({ ...credentials, logId });
          featureState.selectedLog = payload.log;
        }
        rerenderFeature(resultId);
        return true;
      }

      if (action === "edit") {
        const endpoint = findEndpoint(endpointId);
        if (endpoint) {
          openEditForm(endpoint);
          rerenderFeature(resultId);
        }
        return true;
      }

      if (action === "activate") {
        await activateMockApiEndpoint({ ...credentials, id: endpointId });
        await refreshFeature(resultId);
        return true;
      }

      if (action === "archive") {
        await archiveMockApiEndpoint({ ...credentials, id: endpointId });
        await refreshFeature(resultId);
        return true;
      }

      if (action === "restore") {
        await restoreMockApiEndpoint({ ...credentials, id: endpointId });
        await refreshFeature(resultId);
        return true;
      }

      if (action === "clone") {
        await cloneMockApiEndpoint({ ...credentials, id: endpointId });
        await refreshFeature(resultId);
        return true;
      }

      if (action === "delete") {
        await deleteMockApiEndpoint({ ...credentials, id: endpointId });
        if (featureState.selectedEndpointId === endpointId) {
          featureState.selectedEndpointId = "";
          featureState.logs = [];
          featureState.selectedLog = null;
          featureState.selectedLogId = "";
        }
        await refreshFeature(resultId);
        return true;
      }

      if (action === "copy-url") {
        const endpoint = findEndpoint(endpointId);
        if (endpoint?.publicUrl) {
          const absoluteUrl = `${window.location.origin}${endpoint.publicUrl}`;
          await navigator.clipboard.writeText(absoluteUrl);
        }
        return true;
      }
    } catch (error) {
      finishExportResult(
        resultId,
        "Mock API",
        error.message || "Mock API action failed.",
        renderJsonBlockFn({ error: error.message || "Mock API action failed." })
      );
    }

    return true;
  };

  const wireButton = (button) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!state.hasConnection) {
        return;
      }

      const credentials = getCredentials();
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Mock API",
        "Loading mock endpoints...",
        renderLoadingState("Fetching mock API configuration and endpoints...")
      );

      try {
        await loadConfig();
        await loadContext(credentials);
        await loadEndpoints(credentials);
        featureState.activeTab = "active";
        featureState.formMode = "";

        const exportMeta = {
          title: "Mock API",
          status: "Ready",
          exportType: "mock_api",
          hideActions: true,
          editable: false,
          renderBody: () => renderFeatureBody(loadingResultId, configCache),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Mock API",
          error.message || "Failed to load Mock API.",
          renderJsonBlockFn({ error: error.message || "Failed to load Mock API." })
        );
      }
    });
  };

  return {
    handleClick,
    wireButton,
  };
};

export { createMockApiFeature };
