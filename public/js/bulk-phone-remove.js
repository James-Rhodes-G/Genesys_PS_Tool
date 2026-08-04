import { summarizeBulkStatuses } from "./bulk-utils.js";
import {
  createPhoneSelectionHandlers,
  escapeHtml,
  mergeManualPhoneIds,
  normalizePhoneRecord,
  renderPhoneSelectionPanel,
} from "./bulk-phone-utils.js";

const CLASS_PREFIX = "bulk-phone-remove";

const createBulkPhoneRemoveResultsMeta = (resultId, rows, title, status) => ({
  resultId,
  title,
  status,
  exportType: "bulk_phone_remove",
  rows,
  editMode: false,
  availableColumns: [
    { key: "phoneId", header: "Phone ID" },
    { key: "phoneName", header: "Phone Name" },
    { key: "siteName", header: "Site" },
    { key: "status", header: "Status" },
    { key: "error", header: "Error" },
  ],
  selectedColumnKeys: ["phoneId", "phoneName", "siteName", "status", "error"],
});

const renderBulkPhoneRemoveBody = (resultId, exportMeta) =>
  renderPhoneSelectionPanel({
    resultId,
    exportMeta,
    classPrefix: CLASS_PREFIX,
    leftPanelHtml: `<p class="muted">Delete selected phones from the organization. This action cannot be undone.</p>`,
    applyButtonClass: `${CLASS_PREFIX}-apply`,
    applyButtonLabel: "Delete Selected Phones",
  });

const createBulkPhoneRemoveFeature = ({
  state,
  getCachedPhones,
  deletePhones,
  requireCredentials,
  startExportResult,
  finishExportResult,
  rerenderExportSection,
  prependExportResult,
  renderLoadingState,
  renderJsonBlock,
  confirmModal,
}) => {
  const { handleChange, readPhoneFormState, mergeManualPhoneIds: mergePhones } = createPhoneSelectionHandlers({
    state,
    classPrefix: CLASS_PREFIX,
    rerenderExportSection,
  });

  const wireButton = (button, { hasConnection }) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!hasConnection()) {
        return;
      }

      const credentials = requireCredentials("Phone Remover");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Phone Remover",
        "Loading bulk action data...",
        renderLoadingState("Fetching phones...")
      );

      try {
        const phones = await getCachedPhones(credentials);
        const normalizedPhones = phones.map(normalizePhoneRecord).sort((a, b) => a.name.localeCompare(b.name));
        const status = `Loaded ${normalizedPhones.length} phone(s)`;
        const exportMeta = {
          kind: "bulk-phone-remove",
          resultId: loadingResultId,
          title: "Phone Remover",
          status,
          phones: normalizedPhones,
          manualPhoneIds: "",
          phoneFilter: "",
          selectedPhonesById: {},
          renderBody: () => renderBulkPhoneRemoveBody(loadingResultId, state.exportData[loadingResultId]),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Phone Remover",
          error.message || "Phone remover load failed",
          renderJsonBlock(error.payload || { error: error.message || "Phone remover load failed" })
        );
      }
    });
  };

  const executeDelete = async (resultId, exportMeta, selectedPhones) => {
    const resultEl = document.getElementById(resultId);
    const credentials = requireCredentials("Phone Remover");
    if (!resultEl || !exportMeta || !credentials) {
      return;
    }

    resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
      `Deleting ${selectedPhones.length} phone(s)...`
    );

    try {
      const results = await deletePhones({
        ...credentials,
        phoneIds: selectedPhones.map((phone) => phone.id),
      });

      const resultRows = selectedPhones.map((phone) => {
        const deleteResult = results.find((entry) => entry.id === phone.id || entry.phoneId === phone.id);
        return {
          phoneId: phone.id,
          phoneName: phone.name || phone.id,
          siteName: phone.siteName || "",
          status: deleteResult?.status || "unknown",
          error: deleteResult?.error || "",
        };
      });
      const status = summarizeBulkStatuses(resultRows);

      finishExportResult(
        resultId,
        "Phone Remover",
        status,
        "",
        createBulkPhoneRemoveResultsMeta(resultId, resultRows, "Phone Remover", status)
      );
    } catch (error) {
      finishExportResult(
        resultId,
        "Phone Remover",
        error.message || "Phone delete failed",
        renderJsonBlock(error.payload || { error: error.message || "Phone delete failed" })
      );
    }
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const applyButton = target.closest(`.${CLASS_PREFIX}-apply`);
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

    readPhoneFormState(resultId, exportMeta);
    const selectedPhones = mergePhones(exportMeta);
    if (selectedPhones.length === 0) {
      prependExportResult(
        "Phone Remover",
        "No phones selected",
        '<p class="muted">Select or enter at least one phone before deleting.</p>'
      );
      return true;
    }

    confirmModal.open({
      resultId,
      title: "Confirm Phone Deletion",
      bodyHtml: `<div class="bulk-confirm-body">
        <p>Permanently delete <strong>${escapeHtml(selectedPhones.length)}</strong> phone(s)? This cannot be undone.</p>
      </div>`,
      confirmLabel: "Delete Phones",
      onConfirm: async ({ resultId: confirmedResultId, close }) => {
        const confirmedMeta = confirmedResultId ? state.exportData[confirmedResultId] : null;
        if (!confirmedMeta) {
          close();
          return;
        }
        close();
        await executeDelete(confirmedResultId, confirmedMeta, selectedPhones);
      },
    });
    return true;
  };

  return { wireButton, handleClick, handleChange };
};

export { createBulkPhoneRemoveFeature };
