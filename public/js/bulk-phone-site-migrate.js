import { renderGuxFieldSelect, resolveDropdownChange } from "./gux-ui.js";
import { summarizeBulkStatuses } from "./bulk-utils.js";
import {
  escapeHtml,
  isWebRtcPhone,
  mapNamedOptions,
  normalizePhoneRecord,
  renderSelectedPhonesSummary,
} from "./bulk-phone-utils.js";

const CLASS_PREFIX = "bulk-phone-site-migrate";

const createBulkPhoneSiteMigrateResultsMeta = (resultId, rows, title, status) => ({
  resultId,
  title,
  status,
  exportType: "bulk_phone_site_migrate",
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

const getWebRtcPhonesForSite = (phones, siteId) =>
  (phones || []).filter((phone) => isWebRtcPhone(phone) && String(phone.site?.id || phone.siteId) === String(siteId));

const renderSiteOptions = (siteOptions, selectedValue) =>
  (siteOptions || [])
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}"${
          String(option.value) === String(selectedValue || "") ? " selected" : ""
        }>${escapeHtml(option.label)}</option>`
    )
    .join("");

const renderBulkPhoneSiteMigrateBody = (resultId, exportMeta) => {
  const previewPhones = exportMeta.previewPhones || [];

  return `<div class="column-editor">
    <div class="column-editor__header">Phone Site Migrator (WebRTC)</div>
    <p class="muted">Migrate all WebRTC phones from a source site to a destination site.</p>
    <div class="bulk-skill-filters call-spoof-form">
      ${renderGuxFieldSelect({
        escapeHtml,
        inputId: `${resultId}-source-site`,
        className: `${CLASS_PREFIX}-source-site`,
        label: "Source Site",
        optionsHtml: `<option value="">Select source site</option>${renderSiteOptions(
          exportMeta.siteOptions,
          exportMeta.sourceSiteId
        )}`,
        attrs: `data-result-id="${escapeHtml(resultId)}"`,
      })}
      ${renderGuxFieldSelect({
        escapeHtml,
        inputId: `${resultId}-destination-site`,
        className: `${CLASS_PREFIX}-destination-site`,
        label: "Destination Site",
        optionsHtml: `<option value="">Select destination site</option>${renderSiteOptions(
          exportMeta.siteOptions,
          exportMeta.destinationSiteId
        )}`,
        attrs: `data-result-id="${escapeHtml(resultId)}"`,
      })}
    </div>
    <div class="bulk-phone-preview">
      <h4>WebRTC Phones to Migrate (${previewPhones.length})</h4>
      ${renderSelectedPhonesSummary(previewPhones)}
    </div>
  </div>
  <div class="bulk-skill-actions">
    <gux-button class="${CLASS_PREFIX}-apply" type="button" accent="primary" data-result-id="${escapeHtml(
      resultId
    )}">Migrate WebRTC Phones</gux-button>
  </div>`;
};

const createBulkPhoneSiteMigrateFeature = ({
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
  const refreshPreview = (exportMeta) => {
    const sourceSiteId = String(exportMeta.sourceSiteId || "").trim();
    if (!sourceSiteId) {
      exportMeta.previewPhones = [];
      return;
    }

    exportMeta.previewPhones = getWebRtcPhonesForSite(exportMeta.rawPhones || [], sourceSiteId).map(normalizePhoneRecord);
  };

  const wireButton = (button, { hasConnection }) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!hasConnection()) {
        return;
      }

      const credentials = requireCredentials("Phone Site Migrator");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Phone Site Migrator",
        "Loading bulk action data...",
        renderLoadingState("Fetching phones and sites...")
      );

      try {
        const [phones, sites] = await Promise.all([
          getCachedPhones(credentials),
          getCachedSites(credentials),
        ]);

        const status = `Loaded ${phones.length} phone(s) and ${sites.length} site(s)`;
        const exportMeta = {
          kind: "bulk-phone-site-migrate",
          resultId: loadingResultId,
          title: "Phone Site Migrator",
          status,
          rawPhones: phones,
          siteOptions: mapNamedOptions(sites),
          sourceSiteId: "",
          destinationSiteId: "",
          previewPhones: [],
          renderBody: () => renderBulkPhoneSiteMigrateBody(loadingResultId, state.exportData[loadingResultId]),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Phone Site Migrator",
          error.message || "Phone site migrator load failed",
          renderJsonBlock(error.payload || { error: error.message || "Phone site migrator load failed" })
        );
      }
    });
  };

  const executeMigrate = async (resultId, exportMeta, phonesToMove, destinationSiteId) => {
    const resultEl = document.getElementById(resultId);
    const credentials = requireCredentials("Phone Site Migrator");
    if (!resultEl || !exportMeta || !credentials) {
      return;
    }

    resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
      `Migrating ${phonesToMove.length} WebRTC phone(s)...`
    );

    try {
      const results = await movePhonesToSite({
        ...credentials,
        phoneIds: phonesToMove.map((phone) => phone.id),
        siteId: destinationSiteId,
      });

      const resultRows = phonesToMove.map((phone) => {
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
        "Phone Site Migrator",
        status,
        "",
        createBulkPhoneSiteMigrateResultsMeta(resultId, resultRows, "Phone Site Migrator", status)
      );
    } catch (error) {
      finishExportResult(
        resultId,
        "Phone Site Migrator",
        error.message || "Phone site migration failed",
        renderJsonBlock(error.payload || { error: error.message || "Phone site migration failed" })
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

    const sourceSiteId = String(exportMeta.sourceSiteId || "").trim();
    const destinationSiteId = String(exportMeta.destinationSiteId || "").trim();

    if (!sourceSiteId || !destinationSiteId) {
      prependExportResult(
        "Phone Site Migrator",
        "Sites required",
        '<p class="muted">Select both a source and destination site.</p>'
      );
      return true;
    }

    if (sourceSiteId === destinationSiteId) {
      prependExportResult(
        "Phone Site Migrator",
        "Invalid site selection",
        '<p class="muted">Source and destination sites must be different.</p>'
      );
      return true;
    }

    refreshPreview(exportMeta);
    const phonesToMove = exportMeta.previewPhones || [];

    if (phonesToMove.length === 0) {
      prependExportResult(
        "Phone Site Migrator",
        "No WebRTC phones found",
        '<p class="muted">No WebRTC phones are assigned to the selected source site.</p>'
      );
      return true;
    }

    const sourceLabel =
      (exportMeta.siteOptions || []).find((option) => option.value === sourceSiteId)?.label || sourceSiteId;
    const destinationLabel =
      (exportMeta.siteOptions || []).find((option) => option.value === destinationSiteId)?.label || destinationSiteId;

    confirmModal.open({
      resultId,
      title: "Confirm WebRTC Site Migration",
      bodyHtml: `<div class="bulk-confirm-body">
        <p>Migrate <strong>${escapeHtml(phonesToMove.length)}</strong> WebRTC phone(s) from <strong>${escapeHtml(
          sourceLabel
        )}</strong> to <strong>${escapeHtml(destinationLabel)}</strong>?</p>
        ${renderSelectedPhonesSummary(phonesToMove.slice(0, 20))}
        ${
          phonesToMove.length > 20
            ? `<p class="muted">And ${escapeHtml(phonesToMove.length - 20)} more phone(s) not shown.</p>`
            : ""
        }
      </div>`,
      confirmLabel: "Migrate Phones",
      onConfirm: async ({ resultId: confirmedResultId, close }) => {
        const confirmedMeta = confirmedResultId ? state.exportData[confirmedResultId] : null;
        if (!confirmedMeta) {
          close();
          return;
        }
        close();
        await executeMigrate(confirmedResultId, confirmedMeta, phonesToMove, destinationSiteId);
      },
    });
    return true;
  };

  const handleChange = (event) => {
    const sourceChange = resolveDropdownChange(event.target, `${CLASS_PREFIX}-source-site`);
    if (sourceChange) {
      const exportMeta = sourceChange.resultId ? state.exportData[sourceChange.resultId] : null;
      if (exportMeta) {
        exportMeta.sourceSiteId = sourceChange.value;
        refreshPreview(exportMeta);
        rerenderExportSection(sourceChange.resultId);
      }
      return true;
    }

    const destinationChange = resolveDropdownChange(event.target, `${CLASS_PREFIX}-destination-site`);
    if (destinationChange) {
      const exportMeta = destinationChange.resultId ? state.exportData[destinationChange.resultId] : null;
      if (exportMeta) {
        exportMeta.destinationSiteId = destinationChange.value;
        rerenderExportSection(destinationChange.resultId);
      }
      return true;
    }

    return false;
  };

  return { wireButton, handleClick, handleChange };
};

export { createBulkPhoneSiteMigrateFeature };
