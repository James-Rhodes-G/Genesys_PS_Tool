import { renderGuxFieldSelect, resolveDropdownChange } from "./gux-ui.js";
import { summarizeBulkStatuses } from "./bulk-utils.js";
import {
  createPhoneSelectionHandlers,
  escapeHtml,
  mapNamedOptions,
  mergeManualPhoneIds,
  normalizePhoneRecord,
  renderPhoneSelectionPanel,
} from "./bulk-phone-utils.js";

const CLASS_PREFIX = "bulk-phone-move";

const createBulkPhoneMoveResultsMeta = (resultId, rows, title, status) => ({
  resultId,
  title,
  status,
  exportType: "bulk_phone_move",
  rows,
  editMode: false,
  availableColumns: [
    { key: "phoneId", header: "Phone ID" },
    { key: "phoneName", header: "Phone Name" },
    { key: "siteName", header: "Previous Site" },
    { key: "status", header: "Status" },
    { key: "error", header: "Error" },
  ],
  selectedColumnKeys: ["phoneId", "phoneName", "siteName", "status", "error"],
});

const renderBulkPhoneMoveBody = (resultId, exportMeta) => {
  const siteOptionsHtml = (exportMeta.siteOptions || [])
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}"${
          String(option.value) === String(exportMeta.destinationSiteId || "") ? " selected" : ""
        }>${escapeHtml(option.label)}</option>`
    )
    .join("");

  const leftPanelHtml = `${renderGuxFieldSelect({
    escapeHtml,
    inputId: `${resultId}-destination-site`,
    className: `${CLASS_PREFIX}-destination-site`,
    label: "Destination Site",
    optionsHtml: `<option value="">Select destination site</option>${siteOptionsHtml}`,
    attrs: `data-result-id="${escapeHtml(resultId)}"`,
  })}
  <p class="muted">Move selected phones to the destination site.</p>`;

  return renderPhoneSelectionPanel({
    resultId,
    exportMeta,
    classPrefix: CLASS_PREFIX,
    leftPanelHtml,
    applyButtonClass: `${CLASS_PREFIX}-apply`,
    applyButtonLabel: "Move Selected Phones",
  });
};

const createBulkPhoneMoveFeature = ({
  state,
  getCachedPhones,
  getCachedSites,
  movePhonesToSite,
  requireCredentials,
  startExportResult,
  finishExportResult,
  rerenderExportSection,
  prependExportResult,
  renderLoadingState,
  renderJsonBlock,
  confirmModal,
}) => {
  const readExtraFormState = (resultEl, exportMeta) => {
    const siteControl = resultEl.querySelector(`.${CLASS_PREFIX}-destination-site`);
    exportMeta.destinationSiteId = siteControl ? String(siteControl.value || "").trim() : exportMeta.destinationSiteId;
  };

  const { handleChange: handlePhoneSelectionChange, readPhoneFormState, mergeManualPhoneIds: mergePhones } = createPhoneSelectionHandlers({
    state,
    classPrefix: CLASS_PREFIX,
    rerenderExportSection,
    readExtraFormState,
  });

  const wireButton = (button, { hasConnection }) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!hasConnection()) {
        return;
      }

      const credentials = requireCredentials("Phone Mover");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Phone Mover",
        "Loading bulk action data...",
        renderLoadingState("Fetching phones and sites...")
      );

      try {
        const [phones, sites] = await Promise.all([
          getCachedPhones(credentials),
          getCachedSites(credentials),
        ]);

        const normalizedPhones = phones.map(normalizePhoneRecord).sort((a, b) => a.name.localeCompare(b.name));
        const status = `Loaded ${normalizedPhones.length} phone(s) and ${sites.length} site(s)`;
        const exportMeta = {
          kind: "bulk-phone-move",
          resultId: loadingResultId,
          title: "Phone Mover",
          status,
          phones: normalizedPhones,
          siteOptions: mapNamedOptions(sites),
          destinationSiteId: "",
          manualPhoneIds: "",
          phoneFilter: "",
          selectedPhonesById: {},
          renderBody: () => renderBulkPhoneMoveBody(loadingResultId, state.exportData[loadingResultId]),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Phone Mover",
          error.message || "Phone mover load failed",
          renderJsonBlock(error.payload || { error: error.message || "Phone mover load failed" })
        );
      }
    });
  };

  const executeMove = async (resultId, exportMeta, selectedPhones, siteId) => {
    const resultEl = document.getElementById(resultId);
    const credentials = requireCredentials("Phone Mover");
    if (!resultEl || !exportMeta || !credentials) {
      return;
    }

    resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
      `Moving ${selectedPhones.length} phone(s)...`
    );

    try {
      const results = await movePhonesToSite({
        ...credentials,
        phoneIds: selectedPhones.map((phone) => phone.id),
        siteId,
      });

      const resultRows = selectedPhones.map((phone) => {
        const moveResult = results.find((entry) => entry.id === phone.id || entry.phoneId === phone.id);
        return {
          phoneId: phone.id,
          phoneName: phone.name || phone.id,
          siteName: phone.siteName || "",
          status: moveResult?.status || "unknown",
          error: moveResult?.error || "",
        };
      });
      const status = summarizeBulkStatuses(resultRows);

      finishExportResult(
        resultId,
        "Phone Mover",
        status,
        "",
        createBulkPhoneMoveResultsMeta(resultId, resultRows, "Phone Mover", status)
      );
    } catch (error) {
      finishExportResult(
        resultId,
        "Phone Mover",
        error.message || "Phone move failed",
        renderJsonBlock(error.payload || { error: error.message || "Phone move failed" })
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
        "Phone Mover",
        "No phones selected",
        '<p class="muted">Select or enter at least one phone before moving.</p>'
      );
      return true;
    }

    const siteId = String(exportMeta.destinationSiteId || "").trim();
    if (!siteId) {
      prependExportResult(
        "Phone Mover",
        "Destination site required",
        '<p class="muted">Select a destination site before moving phones.</p>'
      );
      return true;
    }

    const destinationSite = (exportMeta.siteOptions || []).find((option) => option.value === siteId);
    const destinationLabel = destinationSite?.label || siteId;

    confirmModal.open({
      resultId,
      title: "Confirm Phone Move",
      bodyHtml: `<div class="bulk-confirm-body">
        <p>Move <strong>${escapeHtml(selectedPhones.length)}</strong> phone(s) to <strong>${escapeHtml(destinationLabel)}</strong>?</p>
      </div>`,
      confirmLabel: "Move Phones",
      onConfirm: async ({ resultId: confirmedResultId, close }) => {
        const confirmedMeta = confirmedResultId ? state.exportData[confirmedResultId] : null;
        if (!confirmedMeta) {
          close();
          return;
        }
        close();
        await executeMove(confirmedResultId, confirmedMeta, selectedPhones, siteId);
      },
    });
    return true;
  };

  const handleChange = (event) => {
    const siteChange = resolveDropdownChange(event.target, `${CLASS_PREFIX}-destination-site`);
    if (siteChange) {
      const exportMeta = siteChange.resultId ? state.exportData[siteChange.resultId] : null;
      if (exportMeta) {
        exportMeta.destinationSiteId = siteChange.value;
      }
      return true;
    }

    return handlePhoneSelectionChange(event);
  };

  return { wireButton, handleClick, handleChange };
};

export { createBulkPhoneMoveFeature };
