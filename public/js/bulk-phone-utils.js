import { renderGuxFieldCheckbox, renderGuxFieldText, renderGuxFieldTextarea } from "./gux-ui.js";
import { mapNamedOptions } from "./bulk-utils.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const parseDelimitedIds = (raw) => {
  const seen = new Set();
  const values = [];

  String(raw || "")
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      if (!seen.has(entry)) {
        seen.add(entry);
        values.push(entry);
      }
    });

  return values;
};

const isWebRtcPhone = (phone) => Boolean(phone?.webRtcUser?.id);

const normalizePhoneRecord = (phone) => ({
  id: phone?.id || "",
  name: phone?.name || phone?.id || "",
  siteId: phone?.site?.id || "",
  siteName: phone?.site?.name || "",
  webRtcUserId: phone?.webRtcUser?.id || "",
});

const filterPhones = (phones, filterText) => {
  const query = String(filterText || "").trim().toLowerCase();
  if (!query) {
    return phones;
  }

  return phones.filter((phone) => {
    const haystack = [phone.name, phone.id, phone.siteName, phone.siteId, phone.webRtcUserId]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
};

const getSelectedPhones = (exportMeta) => Object.values(exportMeta.selectedPhonesById || {});

const mergeManualPhoneIds = (exportMeta) => {
  const manualIds = parseDelimitedIds(exportMeta.manualPhoneIds);
  const selectedById = { ...(exportMeta.selectedPhonesById || {}) };

  manualIds.forEach((phoneId) => {
    if (!selectedById[phoneId]) {
      const cached = (exportMeta.phones || []).find((phone) => phone.id === phoneId);
      selectedById[phoneId] = cached || { id: phoneId, name: phoneId, siteId: "", siteName: "" };
    }
  });

  return Object.values(selectedById);
};

const renderSelectedPhonesSummary = (phones) => {
  if (!phones.length) {
    return '<p class="muted">No phones selected.</p>';
  }

  return `<ul class="bulk-phone-selected-list">${phones
    .map(
      (phone) =>
        `<li><code>${escapeHtml(phone.id)}</code> ${escapeHtml(phone.name || "")}${
          phone.siteName ? ` <span class="muted">(${escapeHtml(phone.siteName)})</span>` : ""
        }</li>`
    )
    .join("")}</ul>`;
};

const renderPhoneSelectionPanel = ({
  resultId,
  exportMeta,
  classPrefix,
  leftPanelHtml,
  applyButtonClass,
  applyButtonLabel,
}) => {
  const filteredPhones = filterPhones(exportMeta.phones || [], exportMeta.phoneFilter);
  const selectedPhoneIds = new Set(Object.keys(exportMeta.selectedPhonesById || {}));
  const allFilteredSelected =
    filteredPhones.length > 0 && filteredPhones.every((phone) => selectedPhoneIds.has(phone.id));

  const phoneRowsHtml = filteredPhones
    .map(
      (phone) =>
        `<div class="bulk-user-row">${renderGuxFieldCheckbox({
          escapeHtml,
          className: `${classPrefix}-phone-checkbox`,
          label: `<span>${escapeHtml(phone.name || phone.id)}</span> <span class="muted">${escapeHtml(
            phone.id
          )}${phone.siteName ? ` · ${escapeHtml(phone.siteName)}` : ""}</span>`,
          checked: selectedPhoneIds.has(phone.id),
          attrs: `data-result-id="${escapeHtml(resultId)}" data-phone-id="${escapeHtml(phone.id)}"`,
        })}</div>`
    )
    .join("");

  const selectedPhones = mergeManualPhoneIds(exportMeta);

  return `<div class="bulk-skill-grid">
    <div class="bulk-skill-panel">
      <h3>Phone Selection</h3>
      ${leftPanelHtml}
      ${renderGuxFieldTextarea({
        escapeHtml,
        inputId: `${resultId}-${classPrefix}-manual-ids`,
        className: `${classPrefix}-manual-ids`,
        label: "Manual Phone IDs",
        value: exportMeta.manualPhoneIds || "",
        rows: 5,
        placeholder: "Paste phone IDs separated by commas or new lines",
        attrs: `data-result-id="${escapeHtml(resultId)}"`,
      })}
    </div>
    <div class="bulk-skill-panel">
      <h3>Cached Phones</h3>
      <div class="bulk-skill-filters">
        ${renderGuxFieldText({
          escapeHtml,
          inputId: `${resultId}-${classPrefix}-phone-filter`,
          className: `${classPrefix}-phone-filter`,
          label: "Filter phones",
          value: exportMeta.phoneFilter || "",
          placeholder: "Search by name, ID, or site",
          attrs: `data-result-id="${escapeHtml(resultId)}"`,
        })}
      </div>
      ${renderGuxFieldCheckbox({
        escapeHtml,
        inputId: `${resultId}-${classPrefix}-select-all-phones`,
        className: `${classPrefix}-select-all-phones`,
        label: `<span class="bulk-select-all-label">Select All Filtered Phones (${filteredPhones.length})</span>`,
        checked: allFilteredSelected,
        attrs: `data-result-id="${escapeHtml(resultId)}"`,
      })}
      <div class="bulk-skill-user-results">${phoneRowsHtml || '<p class="muted">No phones match the current filter.</p>'}</div>
    </div>
  </div>
  <div class="bulk-phone-selected">
    <h4>Selected Phones (${selectedPhones.length})</h4>
    ${renderSelectedPhonesSummary(selectedPhones)}
  </div>
  <div class="bulk-skill-actions">
    <gux-button class="${escapeHtml(applyButtonClass)}" type="button" accent="primary" data-result-id="${escapeHtml(
      resultId
    )}">${escapeHtml(applyButtonLabel)}</gux-button>
  </div>`;
};

const createPhoneSelectionHandlers = ({
  state,
  classPrefix,
  rerenderExportSection,
  readExtraFormState,
}) => {
  const readPhoneFormState = (resultId, exportMeta) => {
    const resultEl = document.getElementById(resultId);
    if (!resultEl) {
      return;
    }

    const manualEl = resultEl.querySelector(`.${classPrefix}-manual-ids`);
    const filterEl = resultEl.querySelector(`.${classPrefix}-phone-filter`);
    exportMeta.manualPhoneIds = manualEl?.value || "";
    exportMeta.phoneFilter = filterEl?.value || "";
    readExtraFormState?.(resultEl, exportMeta);
  };

  const handleChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const resultId = target.getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    if (!resultId || !exportMeta) {
      return false;
    }

    if (target instanceof HTMLInputElement && target.classList.contains(`${classPrefix}-phone-filter`)) {
      exportMeta.phoneFilter = target.value;
      rerenderExportSection(resultId);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains(`${classPrefix}-manual-ids`)) {
      exportMeta.manualPhoneIds = target.value;
      rerenderExportSection(resultId);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains(`${classPrefix}-phone-checkbox`)) {
      const phoneId = target.getAttribute("data-phone-id");
      if (!phoneId) {
        return false;
      }

      const nextSelected = { ...(exportMeta.selectedPhonesById || {}) };
      if (target.checked) {
        const phone = (exportMeta.phones || []).find((entry) => entry.id === phoneId);
        nextSelected[phoneId] = phone || { id: phoneId, name: phoneId };
      } else {
        delete nextSelected[phoneId];
      }

      exportMeta.selectedPhonesById = nextSelected;
      rerenderExportSection(resultId);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains(`${classPrefix}-select-all-phones`)) {
      const filteredPhones = filterPhones(exportMeta.phones || [], exportMeta.phoneFilter);
      const nextSelected = { ...(exportMeta.selectedPhonesById || {}) };

      if (target.checked) {
        filteredPhones.forEach((phone) => {
          nextSelected[phone.id] = phone;
        });
      } else {
        filteredPhones.forEach((phone) => {
          delete nextSelected[phone.id];
        });
      }

      exportMeta.selectedPhonesById = nextSelected;
      rerenderExportSection(resultId);
      return true;
    }

    return false;
  };

  return {
    handleChange,
    readPhoneFormState,
    mergeManualPhoneIds,
  };
};

export {
  createPhoneSelectionHandlers,
  escapeHtml,
  filterPhones,
  getSelectedPhones,
  isWebRtcPhone,
  mapNamedOptions,
  mergeManualPhoneIds,
  normalizePhoneRecord,
  parseDelimitedIds,
  renderPhoneSelectionPanel,
  renderSelectedPhonesSummary,
};
