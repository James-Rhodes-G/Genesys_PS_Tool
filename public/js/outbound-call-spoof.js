import { renderGuxTable, renderGuxTableToolbar } from "./gux-ui.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const OUTBOUND_HISTORY_KEY = "ps-tool:call-spoof-history:outbound";

const defaultOutboundState = () => ({
  phoneNumber: "",
  callerId: "",
  callerIdName: "",
});

const createOutboundCallSpoofFeature = ({
  state,
  spoofOutboundCall,
  requireCredentials,
  startExportResult,
  finishExportResult,
  renderLoadingState,
  renderJsonBlock,
  createOutboundCallSpoofResultsMeta,
  confirmModal,
  loadFieldHistory,
  rememberFieldHistory,
  renderGuxPhoneField,
  renderGuxTextField,
  readControlValue,
  resolveFieldClass,
}) => {
  const historyListId = (resultId, fieldKey) => `${resultId}-${fieldKey}-history`;

  const buildResultsMeta = (resultId, resultRows, status, formState) => {
    const meta = createOutboundCallSpoofResultsMeta(resultId, resultRows, "Outbound Call Spoof", status);
    const row = resultRows[0] || {};

    Object.assign(meta, {
      ...defaultOutboundState(),
      ...formState,
      phoneNumber: row.phoneNumber || formState.phoneNumber || "",
      callerId: row.callerId || formState.callerId || "",
      callerIdName: row.callerIdName || formState.callerIdName || "",
      renderBody: () =>
        renderGuxTable({
          toolbarHtml: renderGuxTableToolbar({
            escapeHtml,
            className: "call-spoof-toolbar",
            primaryActionHtml: `<gux-table-toolbar-custom-action
        slot="primary-action"
        accent="primary"
        class="outbound-call-spoof-retry-action"
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

  const readFormState = (resultEl, exportMeta) => ({
    phoneNumber: String(readControlValue(resultEl, "outbound-call-spoof-phone-number")).trim(),
    callerId: String(readControlValue(resultEl, "outbound-call-spoof-caller-id")).trim(),
    callerIdName: String(readControlValue(resultEl, "outbound-call-spoof-caller-id-name")).trim(),
    callUserId: exportMeta.callUserId || "",
    callUserLabel: exportMeta.callUserLabel || "",
  });

  const persistHistory = (formState) => {
    rememberFieldHistory(OUTBOUND_HISTORY_KEY, "phoneNumber", formState.phoneNumber);
    rememberFieldHistory(OUTBOUND_HISTORY_KEY, "callerId", formState.callerId);
    rememberFieldHistory(OUTBOUND_HISTORY_KEY, "callerIdName", formState.callerIdName);
  };

  const runSpoofCall = async ({ resultId, formState }) => {
    const credentials = requireCredentials("Outbound Call Spoof");
    const resultEl = resultId ? document.getElementById(resultId) : null;
    if (!credentials || !resultEl) {
      return;
    }

    resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
      `Placing spoofed call to ${formState.phoneNumber}...`
    );

    try {
      persistHistory(formState);
      const call = await spoofOutboundCall({
        ...credentials,
        phoneNumber: formState.phoneNumber,
        callerId: formState.callerId,
        callerIdName: formState.callerIdName,
      });

      const resultRows = [
        {
          phoneNumber: formState.phoneNumber,
          callerId: formState.callerId,
          callerIdName: formState.callerIdName,
          conversationId: call?.conversationId || "",
          status: "success",
          error: "",
        },
      ];

      finishExportResult(
        resultId,
        "Outbound Call Spoof",
        "Call initiated successfully",
        "",
        buildResultsMeta(resultId, resultRows, "Call initiated successfully", formState)
      );
    } catch (error) {
      finishExportResult(
        resultId,
        "Outbound Call Spoof",
        error.message || "Call spoof failed",
        renderJsonBlock(error.payload || { error: error.message || "Call spoof failed" })
      );
    }
  };

  const renderSelection = (resultId, featureState) => {
    const stateValues = {
      ...defaultOutboundState(),
      ...featureState,
    };

    return `<div class="column-editor">
      <div class="column-editor__header">Outbound Call Spoof</div>
      <p class="muted">Place an outbound call using spoofed caller ID settings.</p>
      <div class="sidebar-actions call-spoof-form">
        ${renderGuxPhoneField({
          escapeHtml,
          resultId,
          className: "outbound-call-spoof-caller-id",
          label: "Outbound CLID",
          value: stateValues.callerId,
          historyEntries: loadFieldHistory(OUTBOUND_HISTORY_KEY, "callerId"),
          listId: historyListId(resultId, "caller-id"),
        })}
        ${renderGuxTextField({
          escapeHtml,
          resultId,
          className: "outbound-call-spoof-caller-id-name",
          label: "Outbound CNAM",
          value: stateValues.callerIdName,
          historyEntries: loadFieldHistory(OUTBOUND_HISTORY_KEY, "callerIdName"),
          listId: historyListId(resultId, "caller-id-name"),
        })}
        ${renderGuxPhoneField({
          escapeHtml,
          resultId,
          className: "outbound-call-spoof-phone-number",
          label: "Number to Dial",
          value: stateValues.phoneNumber,
          historyEntries: loadFieldHistory(OUTBOUND_HISTORY_KEY, "phoneNumber"),
          listId: historyListId(resultId, "phone-number"),
        })}
        <div class="bulk-control-row bulk-control-row--actions">
          <gux-button class="outbound-call-spoof-apply" type="button" accent="primary" data-result-id="${escapeHtml(
            resultId
          )}">Place Spoofed Call</gux-button>
        </div>
      </div>
    </div>`;
  };

  const buildConfirmSummary = (formState) =>
    `<p>Place a call to <strong>${escapeHtml(formState.phoneNumber)}</strong> using caller ID <strong>${escapeHtml(
      formState.callerId || "(blank)"
    )}</strong> and caller name <strong>${escapeHtml(formState.callerIdName || "(blank)")}</strong>.</p>`;

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const retryButton = target.closest(".outbound-call-spoof-retry-action");
    const applyButton = target.closest(".outbound-call-spoof-apply");
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

    if (!formState.phoneNumber) {
      confirmModal.open({
        resultId,
        title: "Number to Dial Required",
        bodyHtml: "<p>Enter a phone number before placing the spoofed call.</p>",
        confirmHidden: true,
        cancelLabel: "Close",
      });
      return true;
    }

    if (!requireCredentials("Outbound Call Spoof")) {
      return true;
    }

    confirmModal.open({
      resultId,
      title: retryButton ? "Confirm Outbound Call Spoof Retry" : "Confirm Outbound Call Spoof",
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
      "outbound-call-spoof-phone-number": "phoneNumber",
      "outbound-call-spoof-caller-id": "callerId",
      "outbound-call-spoof-caller-id-name": "callerIdName",
    };
    const matchedClass = resolveFieldClass(target, Object.keys(classMap));
    if (!matchedClass) {
      return false;
    }

    const fieldControl = target.closest(`.${matchedClass}`) || target;
    const resultId = fieldControl.getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    if (!resultId || !exportMeta) {
      return false;
    }

    exportMeta[classMap[matchedClass]] = readControlValue(document.getElementById(resultId), matchedClass);
    return true;
  };

  const wireButton = (button) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!state.hasConnection || !requireCredentials("Outbound Call Spoof")) {
        return;
      }

      const loadingResultId = startExportResult(
        "Outbound Call Spoof",
        "Loading call spoof workflow...",
        renderLoadingState("Preparing outbound call spoof workspace...")
      );

      const exportMeta = {
        resultId: loadingResultId,
        title: "Outbound Call Spoof",
        status: "Ready to place call",
        exportType: "call_spoof_setup",
        kind: "outbound-call-spoof",
        hideActions: true,
        editable: false,
        ...defaultOutboundState(),
        renderBody: () => renderSelection(loadingResultId, state.exportData[loadingResultId] || exportMeta),
      };

      state.exportData[loadingResultId] = exportMeta;
      finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
    });
  };

  return {
    handleClick,
    handleChange,
    wireButton,
  };
};

export { createOutboundCallSpoofFeature };
