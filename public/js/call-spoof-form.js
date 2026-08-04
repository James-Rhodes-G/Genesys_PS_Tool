import {
  readControlValue,
  resolveFieldClass,
} from "./gux-ui.js";

const HISTORY_LIMIT = 5;

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (America/New_York)" },
  { value: "America/Chicago", label: "Central (America/Chicago)" },
  { value: "America/Denver", label: "Mountain (America/Denver)" },
  { value: "America/Phoenix", label: "Arizona (America/Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (America/Los_Angeles)" },
  { value: "America/Anchorage", label: "Alaska (America/Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Pacific/Honolulu)" },
  { value: "America/Puerto_Rico", label: "Atlantic (America/Puerto_Rico)" },
];

const loadHistoryStore = (storageKey) => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
};

const saveHistoryStore = (storageKey, store) => {
  window.localStorage.setItem(storageKey, JSON.stringify(store));
};

const loadFieldHistory = (storageKey, fieldKey) => {
  const store = loadHistoryStore(storageKey);
  const entries = store[fieldKey];
  return Array.isArray(entries) ? entries.filter(Boolean).slice(0, HISTORY_LIMIT) : [];
};

const rememberFieldHistory = (storageKey, fieldKey, value) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return loadFieldHistory(storageKey, fieldKey);
  }

  const store = loadHistoryStore(storageKey);
  const nextEntries = [normalized, ...loadFieldHistory(storageKey, fieldKey).filter((entry) => entry !== normalized)].slice(
    0,
    HISTORY_LIMIT
  );
  store[fieldKey] = nextEntries;
  saveHistoryStore(storageKey, store);
  return nextEntries;
};

const renderHistoryOptions = (entries, escapeHtml) =>
  entries.map((entry) => `<option value="${escapeHtml(entry)}"></option>`).join("");

const renderGuxTextareaField = ({
  escapeHtml,
  resultId,
  className,
  label,
  value,
  placeholder,
  historyEntries,
  listId,
  rows = 4,
}) => {
  const inputId = `${resultId}-${className}`;
  const datalistHtml = historyEntries.length
    ? `<datalist id="${escapeHtml(listId)}">${renderHistoryOptions(historyEntries, escapeHtml)}</datalist>`
    : "";

  return `<div class="field-container">
    <gux-form-field-textarea label-position="above">
      <textarea
        slot="input"
        id="${escapeHtml(inputId)}"
        class="${escapeHtml(className)}"
        data-result-id="${escapeHtml(resultId)}"
        rows="${rows}"
        placeholder="${escapeHtml(placeholder || "")}"
        ${historyEntries.length ? `list="${escapeHtml(listId)}"` : ""}
      >${escapeHtml(value || "")}</textarea>
      <label slot="label">${escapeHtml(label)}</label>
    </gux-form-field-textarea>
    ${datalistHtml}
  </div>`;
};

const renderGuxTextField = ({
  escapeHtml,
  resultId,
  className,
  label,
  value,
  placeholder,
  historyEntries,
  listId,
  multiline = false,
}) => {
  if (multiline) {
    return renderGuxTextareaField({
      escapeHtml,
      resultId,
      className,
      label,
      value,
      placeholder,
      historyEntries,
      listId,
    });
  }

  const inputId = `${resultId}-${className}`;
  const datalistHtml = historyEntries.length
    ? `<datalist id="${escapeHtml(listId)}">${renderHistoryOptions(historyEntries, escapeHtml)}</datalist>`
    : "";

  const inputHtml = `<input slot="input" id="${escapeHtml(inputId)}" class="${escapeHtml(
    className
  )}" data-result-id="${escapeHtml(resultId)}" type="text" value="${escapeHtml(
    value || ""
  )}"${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ""}${
    historyEntries.length ? ` list="${escapeHtml(listId)}"` : ""
  } />`;

  return `<div class="field-container">
    <gux-form-field-text-like label-position="above" clearable="true">
      ${inputHtml}
      <label slot="label">${escapeHtml(label)}</label>
    </gux-form-field-text-like>
    ${datalistHtml}
  </div>`;
};

const renderGuxPhoneField = ({
  escapeHtml,
  resultId,
  className,
  label,
  value,
  historyEntries,
  listId,
}) => {
  const inputId = `${resultId}-${className}`;
  const datalistHtml = historyEntries.length
    ? `<datalist id="${escapeHtml(listId)}">${renderHistoryOptions(historyEntries, escapeHtml)}</datalist>`
    : "";

  return `<div class="field-container">
    <gux-form-field-phone label-position="above">
      <gux-phone-input-beta
        phone-number-format="E164"
        id="${escapeHtml(inputId)}"
        class="${escapeHtml(className)}"
        data-result-id="${escapeHtml(resultId)}"
        value="${escapeHtml(value || "")}"
        ${historyEntries.length ? `list="${escapeHtml(listId)}"` : ""}
      ></gux-phone-input-beta>
      <label slot="label">${escapeHtml(label)}</label>
    </gux-form-field-phone>
    ${datalistHtml}
  </div>`;
};

const renderGuxDateTimeField = ({ escapeHtml, resultId, className, label, value }) => {
  const inputId = `${resultId}-${className}`;

  return `<div class="field-container">
    <gux-form-field-text-like label-position="above" clearable="true">
      <input slot="input" id="${escapeHtml(inputId)}" class="${escapeHtml(
        className
      )}" data-result-id="${escapeHtml(resultId)}" type="datetime-local" value="${escapeHtml(value || "")}" />
      <label slot="label">${escapeHtml(label)}</label>
    </gux-form-field-text-like>
  </div>`;
};

const renderGuxTimezoneDropdown = ({ escapeHtml, resultId, className, label, value }) => {
  const dropdownId = `${resultId}-${className}`;
  const selectedValue = value || US_TIMEZONES[0]?.value || "";

  return `<div class="field-container">
    <label class="field-label" for="${escapeHtml(dropdownId)}">${escapeHtml(label)}</label>
    <gux-dropdown
      id="${escapeHtml(dropdownId)}"
      class="${escapeHtml(className)}"
      data-result-id="${escapeHtml(resultId)}"
      placeholder="Select a time zone"
      value="${escapeHtml(selectedValue)}"
    >
      <gux-listbox aria-label="Time zones">
        ${US_TIMEZONES.map(
          (zone) =>
            `<gux-option value="${escapeHtml(zone.value)}"${
              zone.value === selectedValue ? " selected" : ""
            }>${escapeHtml(zone.label)}</gux-option>`
        ).join("")}
      </gux-listbox>
    </gux-dropdown>
  </div>`;
};

const toDateTimeLocalValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  const pad = (part) => String(part).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(
    parsed.getHours()
  )}:${pad(parsed.getMinutes())}`;
};

const formatDateTimeForAttribute = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return parsed.toISOString();
};

const parseCustomAttributesText = (raw) => {
  const text = String(raw || "").trim();
  if (!text) {
    return {};
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [String(key), String(value ?? "")])
      );
    }
  } catch (_error) {
    // Fall back to key=value lines.
  }

  return text.split("\n").reduce((attributes, line) => {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      return attributes;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      attributes[key] = value;
    }
    return attributes;
  }, {});
};

export {
  HISTORY_LIMIT,
  US_TIMEZONES,
  formatDateTimeForAttribute,
  loadFieldHistory,
  parseCustomAttributesText,
  readControlValue,
  rememberFieldHistory,
  renderGuxDateTimeField,
  renderGuxPhoneField,
  renderGuxTextField,
  renderGuxTextareaField,
  renderGuxTimezoneDropdown,
  resolveFieldClass,
  toDateTimeLocalValue,
};
