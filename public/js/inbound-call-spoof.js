import { renderGuxTable, renderGuxTableToolbar } from "./gux-ui.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const INBOUND_HISTORY_KEY = "ps-tool:call-spoof-history:inbound";

const defaultInboundState = () => ({
  inboundDnis: "",
  callerId: "",
  callerIdName: "",
  callDateTime: "",
  callTimeZone: "America/New_York",
  uuiData: "",
  customAttributesText: "",
  description: "",
  callUserId: "",
  callUserLabel: "",
});

const createInboundCallSpoofFeature = ({
  state,
  getCurrentUser,
  spoofInboundCall,
  requireCredentials,
  startExportResult,
  finishExportResult,
  renderLoadingState,
  renderJsonBlock,
  createInboundCallSpoofResultsMeta,
  confirmModal,
  loadFieldHistory,
  rememberFieldHistory,
  renderGuxPhoneField,
  renderGuxTextField,
  renderGuxTextareaField,
  renderGuxDateTimeField,
  renderGuxTimezoneDropdown,
  readControlValue,
  resolveFieldClass,
  formatDateTimeForAttribute,
  parseCustomAttributesText,
  toDateTimeLocalValue,
}) => {
  const historyListId = (resultId, fieldKey) => `${resultId}-${fieldKey}-history`;

  const buildResultsMeta = (resultId, resultRows, status, formState) => {
    const meta = createInboundCallSpoofResultsMeta(resultId, resultRows, "Inbound Call Spoof", status);
    const row = resultRows[0] || {};

    Object.assign(meta, {
      ...defaultInboundState(),
      ...formState,
      inboundDnis: row.inboundDnis || formState.inboundDnis || "",
      callerId: row.callerId || formState.callerId || "",
      callerIdName: row.callerIdName || formState.callerIdName || "",
      callDateTime: row.callDateTime || formState.callDateTime || "",
      callTimeZone: row.callTimeZone || formState.callTimeZone || "",
      uuiData: row.uuiData || formState.uuiData || "",
      description: row.description || formState.description || "",
      customAttributesText: formState.customAttributesText || "",
      callUserId: row.callUserId || formState.callUserId || "",
      callUserLabel: formState.callUserLabel || "",
      renderBody: () =>
        renderGuxTable({
          toolbarHtml: renderGuxTableToolbar({
            escapeHtml,
            className: "call-spoof-toolbar",
            primaryActionHtml: `<gux-table-toolbar-custom-action
        slot="primary-action"
        accent="primary"
        class="inbound-call-spoof-retry-action"
        data-result-id="${escapeHtml(resultId)}"
      >
        <span slot="text">Try Again</span>
        <gux-icon slot="icon" icon-name="refresh" decorative></gux-icon>
      </gux-table-toolbar-custom-action>`,
          }),
          shell: true,
          columns: meta.availableColumns.filter((column) => meta.selectedColumnKeys.includes(column.key)),
          rows: [row],
          renderCell: (column, tableRow) => {
            if (typeof column.renderCell === "function") {
              return column.renderCell(tableRow);
            }
            return escapeHtml(String(tableRow?.[column.key] ?? ""));
          },
          escapeHtml,
        }),
    });
    return meta;
  };

  const readFormState = (resultEl, exportMeta) => {
    const callDateTimeLocal = readControlValue(resultEl, "inbound-call-spoof-call-datetime");

    return {
      inboundDnis: String(readControlValue(resultEl, "inbound-call-spoof-inbound-dnis")).trim(),
      callerId: String(readControlValue(resultEl, "inbound-call-spoof-caller-id")).trim(),
      callerIdName: String(readControlValue(resultEl, "inbound-call-spoof-caller-id-name")).trim(),
      callDateTime: formatDateTimeForAttribute(callDateTimeLocal),
      callTimeZone: String(readControlValue(resultEl, "inbound-call-spoof-call-timezone")).trim(),
      uuiData: String(readControlValue(resultEl, "inbound-call-spoof-uui-data")).trim(),
      customAttributesText: String(readControlValue(resultEl, "inbound-call-spoof-custom-attributes")).trim(),
      description: String(readControlValue(resultEl, "inbound-call-spoof-description")).trim(),
      customAttributes: parseCustomAttributesText(
        readControlValue(resultEl, "inbound-call-spoof-custom-attributes")
      ),
      callUserId: exportMeta.callUserId || "",
      callUserLabel: exportMeta.callUserLabel || "",
    };
  };

  const persistHistory = (formState) => {
    rememberFieldHistory(INBOUND_HISTORY_KEY, "inboundDnis", formState.inboundDnis);
    rememberFieldHistory(INBOUND_HISTORY_KEY, "callerId", formState.callerId);
    rememberFieldHistory(INBOUND_HISTORY_KEY, "callerIdName", formState.callerIdName);
    rememberFieldHistory(INBOUND_HISTORY_KEY, "uuiData", formState.uuiData);
    rememberFieldHistory(INBOUND_HISTORY_KEY, "description", formState.description);
    rememberFieldHistory(INBOUND_HISTORY_KEY, "customAttributesText", formState.customAttributesText);
  };

  const runSpoofCall = async ({ resultId, formState }) => {
    const credentials = requireCredentials("Inbound Call Spoof");
    const resultEl = resultId ? document.getElementById(resultId) : null;
    if (!credentials || !resultEl) {
      return;
    }

    resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
      `Triggering inbound spoof call for ${formState.callUserLabel || "current user"}...`
    );

    try {
      persistHistory(formState);
      const call = await spoofInboundCall({
        ...credentials,
        callUserId: formState.callUserId,
        inboundDnis: formState.inboundDnis,
        callerId: formState.callerId,
        callerIdName: formState.callerIdName,
        uuiData: formState.uuiData,
        callDateTime: formState.callDateTime,
        callTimeZone: formState.callTimeZone,
        description: formState.description,
        customAttributes: formState.customAttributes,
      });

      const resultRows = [
        {
          callUserLabel: formState.callUserLabel,
          inboundDnis: formState.inboundDnis,
          callerId: formState.callerId,
          callerIdName: formState.callerIdName,
          callDateTime: formState.callDateTime,
          callTimeZone: formState.callTimeZone,
          uuiData: formState.uuiData,
          description: formState.description,
          conversationId: call?.conversationId || "",
          callUserId: call?.callUserId || formState.callUserId || "",
          status: "success",
          error: "",
        },
      ];

      finishExportResult(
        resultId,
        "Inbound Call Spoof",
        "Call initiated successfully",
        "",
        buildResultsMeta(resultId, resultRows, "Call initiated successfully", formState)
      );
    } catch (error) {
      finishExportResult(
        resultId,
        "Inbound Call Spoof",
        error.message || "Call spoof failed",
        renderJsonBlock(error.payload || { error: error.message || "Call spoof failed" })
      );
    }
  };

  const renderSelection = (resultId, featureState) => {
    const stateValues = {
      ...defaultInboundState(),
      ...featureState,
    };

    return `<div class="column-editor">
      <div class="column-editor__header">Inbound Call Spoof</div>
      <p class="muted">Triggers a call to the connected user using their current phone. Inbound DNIS, date/time, and timezone are sent as conversation attributes for Architect testing.</p>
      ${
        stateValues.callUserLabel
          ? `<p class="muted"><strong>Connected user:</strong> ${escapeHtml(stateValues.callUserLabel)}</p>`
          : ""
      }
      <div class="sidebar-actions call-spoof-form">
        ${renderGuxTextField({
          escapeHtml,
          resultId,
          className: "inbound-call-spoof-inbound-dnis",
          label: "Inbound DNIS",
          value: stateValues.inboundDnis,
          placeholder: "Routing table DNIS",
          historyEntries: loadFieldHistory(INBOUND_HISTORY_KEY, "inboundDnis"),
          listId: historyListId(resultId, "inbound-dnis"),
        })}
        ${renderGuxPhoneField({
          escapeHtml,
          resultId,
          className: "inbound-call-spoof-caller-id",
          label: "Caller ID / ANI",
          value: stateValues.callerId,
          historyEntries: loadFieldHistory(INBOUND_HISTORY_KEY, "callerId"),
          listId: historyListId(resultId, "caller-id"),
        })}
        ${renderGuxTextField({
          escapeHtml,
          resultId,
          className: "inbound-call-spoof-caller-id-name",
          label: "Caller ID Name",
          value: stateValues.callerIdName,
          historyEntries: loadFieldHistory(INBOUND_HISTORY_KEY, "callerIdName"),
          listId: historyListId(resultId, "caller-id-name"),
        })}
        ${renderGuxDateTimeField({
          escapeHtml,
          resultId,
          className: "inbound-call-spoof-call-datetime",
          label: "Date and Time",
          value: toDateTimeLocalValue(stateValues.callDateTime),
        })}
        ${renderGuxTimezoneDropdown({
          escapeHtml,
          resultId,
          className: "inbound-call-spoof-call-timezone",
          label: "Time Zone",
          value: stateValues.callTimeZone,
        })}
        ${renderGuxTextField({
          escapeHtml,
          resultId,
          className: "inbound-call-spoof-uui-data",
          label: "UUI Data",
          value: stateValues.uuiData,
          historyEntries: loadFieldHistory(INBOUND_HISTORY_KEY, "uuiData"),
          listId: historyListId(resultId, "uui-data"),
        })}
        ${renderGuxTextareaField({
          escapeHtml,
          resultId,
          className: "inbound-call-spoof-custom-attributes",
          label: "Custom Attributes",
          value: stateValues.customAttributesText,
          placeholder: "key=value (one per line) or JSON object",
          historyEntries: loadFieldHistory(INBOUND_HISTORY_KEY, "customAttributesText"),
          listId: historyListId(resultId, "custom-attributes"),
        })}
        ${renderGuxTextField({
          escapeHtml,
          resultId,
          className: "inbound-call-spoof-description",
          label: "Description",
          value: stateValues.description,
          historyEntries: loadFieldHistory(INBOUND_HISTORY_KEY, "description"),
          listId: historyListId(resultId, "description"),
        })}
        <div class="bulk-control-row bulk-control-row--actions">
          <gux-button class="inbound-call-spoof-apply" type="button" accent="primary" data-result-id="${escapeHtml(
            resultId
          )}">Place Call</gux-button>
        </div>
      </div>
    </div>`;
  };

  const buildConfirmSummary = (formState) => {
    const lines = [
      `<p>Trigger an inbound spoof call for <strong>${escapeHtml(
        formState.callUserLabel || "the connected user"
      )}</strong>.</p>`,
      `<ul>
        <li><strong>Inbound DNIS:</strong> ${escapeHtml(formState.inboundDnis || "(blank)")}</li>
        <li><strong>Caller ID / ANI:</strong> ${escapeHtml(formState.callerId || "(blank)")}</li>
        <li><strong>Caller ID Name:</strong> ${escapeHtml(formState.callerIdName || "(blank)")}</li>
        <li><strong>Date and Time:</strong> ${escapeHtml(formState.callDateTime || "(blank)")}</li>
        <li><strong>Time Zone:</strong> ${escapeHtml(formState.callTimeZone || "(blank)")}</li>
        <li><strong>UUI Data:</strong> ${escapeHtml(formState.uuiData || "(blank)")}</li>
        <li><strong>Description:</strong> ${escapeHtml(formState.description || "(blank)")}</li>
      </ul>`,
    ];

    if (formState.customAttributesText) {
      lines.push(
        `<p><strong>Custom Attributes:</strong></p><pre>${escapeHtml(formState.customAttributesText)}</pre>`
      );
    }

    return lines.join("");
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const retryButton = target.closest(".inbound-call-spoof-retry-action");
    const applyButton = target.closest(".inbound-call-spoof-apply");
    if (!retryButton && !applyButton) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const resultId = (retryButton || applyButton).getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    const resultEl = resultId ? document.getElementById(resultId) : null;
    if (!resultId || !exportMeta || !resultEl) {
      return true;
    }

    const formState = readFormState(resultEl, exportMeta);
    Object.assign(exportMeta, formState);

    if (!formState.inboundDnis) {
      confirmModal.open({
        resultId,
        title: "Inbound DNIS Required",
        bodyHtml: "<p>Enter an inbound DNIS from the routing table before placing the spoofed call.</p>",
        confirmHidden: true,
        cancelLabel: "Close",
      });
      return true;
    }

    if (!requireCredentials("Inbound Call Spoof")) {
      return true;
    }

    confirmModal.open({
      resultId,
      title: retryButton ? "Confirm Inbound Call Spoof Retry" : "Confirm Inbound Call Spoof",
      bodyHtml: buildConfirmSummary(formState),
      confirmLabel: retryButton ? "Try Again" : "Place Call",
      onConfirm: async ({ close }) => {
        close();
        await runSpoofCall({ resultId, formState });
      },
    });

    return true;
  };

  const handleChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const classMap = {
      "inbound-call-spoof-inbound-dnis": "inboundDnis",
      "inbound-call-spoof-caller-id": "callerId",
      "inbound-call-spoof-caller-id-name": "callerIdName",
      "inbound-call-spoof-call-datetime": "callDateTime",
      "inbound-call-spoof-call-timezone": "callTimeZone",
      "inbound-call-spoof-uui-data": "uuiData",
      "inbound-call-spoof-custom-attributes": "customAttributesText",
      "inbound-call-spoof-description": "description",
    };
    const matchedClass = resolveFieldClass(target, Object.keys(classMap));
    if (!matchedClass) {
      return false;
    }

    const fieldControl = target.closest(`.${matchedClass}`) || target;
    const resultId = fieldControl.getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    const resultEl = resultId ? document.getElementById(resultId) : null;
    if (!resultId || !exportMeta || !resultEl) {
      return false;
    }

    exportMeta[classMap[matchedClass]] = readControlValue(resultEl, matchedClass);
    return true;
  };

  const wireButton = (button) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!state.hasConnection || !requireCredentials("Inbound Call Spoof")) {
        return;
      }

      const loadingResultId = startExportResult(
        "Inbound Call Spoof",
        "Loading call spoof workflow...",
        renderLoadingState("Preparing inbound call spoof workspace...")
      );

      try {
        const credentials = requireCredentials("Inbound Call Spoof");
        const currentUser = await getCurrentUser(credentials);
        const callUserLabel =
          currentUser?.name || currentUser?.username || currentUser?.email || currentUser?.id || "Current user";
        const exportMeta = {
          resultId: loadingResultId,
          title: "Inbound Call Spoof",
          status: "Ready to place call",
          exportType: "inbound_call_spoof_setup",
          kind: "inbound-call-spoof",
          hideActions: true,
          editable: false,
          ...defaultInboundState(),
          callUserId: currentUser?.id || "",
          callUserLabel,
          renderBody: () => renderSelection(loadingResultId, state.exportData[loadingResultId] || exportMeta),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Inbound Call Spoof",
          error.message || "Call spoof setup failed",
          renderJsonBlock(error.payload || { error: error.message || "Call spoof setup failed" })
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

export { createInboundCallSpoofFeature };
