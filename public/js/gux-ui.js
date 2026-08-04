const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderGuxTableToolbar = ({
  escapeHtml: escapeHtmlFn,
  className = "",
  primaryActionHtml = "",
  menuActionsHtml = "",
  searchAndFilterHtml = "",
  contextualActionsHtml = "",
  permanentActionsHtml = "",
}) => {
  const safeEscape = escapeHtmlFn || escapeHtml;

  return `<gux-table-toolbar${className ? ` class="${safeEscape(className)}"` : ""}>
    ${searchAndFilterHtml ? `<div slot="search-and-filter">${searchAndFilterHtml}</div>` : ""}
    ${contextualActionsHtml ? `<div slot="contextual-actions">${contextualActionsHtml}</div>` : ""}
    ${permanentActionsHtml ? `<div slot="permanent-actions">${permanentActionsHtml}</div>` : ""}
    ${primaryActionHtml}
    <span slot="menu-actions">${menuActionsHtml}</span>
  </gux-table-toolbar>`;
};

const renderGuxTable = ({
  columns,
  rows,
  renderCell,
  escapeHtml: escapeHtmlFn,
  className = "",
  toolbarHtml = "",
  tableAttrs = "",
  emptyMessage = "",
  compact = false,
  shell = false,
  columnWidths = {},
  resizable = false,
  wrapCells = false,
}) => {
  const safeEscape = escapeHtmlFn || escapeHtml;
  if (!columns.length) {
    return "";
  }

  const colgroupHtml = `<colgroup>${columns
    .map((column) => {
      const width = Number(columnWidths[column.key]);
      return Number.isFinite(width) && width > 0
        ? `<col style="width: ${Math.round(width)}px">`
        : "<col>";
    })
    .join("")}</colgroup>`;

  const headerHtml = columns
    .map((column) => {
      const width = Number(columnWidths[column.key]);
      const widthStyle =
        Number.isFinite(width) && width > 0 ? ` style="width: ${Math.round(width)}px;"` : "";
      const resizeHandle = resizable
        ? '<span class="column-resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize column"></span>'
        : "";

      return `<th data-column-key="${safeEscape(column.key)}"${widthStyle}>${safeEscape(
        column.header
      )}${resizeHandle}</th>`;
    })
    .join("");

  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => {
            const cellHtml = renderCell(column, row);
            const content = wrapCells ? `<div class="export-table-cell">${cellHtml}</div>` : cellHtml;
            return `<td>${content}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  const tableClassName = ["export-data-table", className].filter(Boolean).join(" ");
  const tableHtml = `<gux-table${className ? ` class="${safeEscape(className)}"` : ""}${
    emptyMessage ? ` empty-message="${safeEscape(emptyMessage)}"` : ""
  }${compact ? ' compact="true"' : ""}>
    <table slot="data" class="${safeEscape(tableClassName)}"${tableAttrs ? ` ${tableAttrs}` : ""}>
      ${colgroupHtml}
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  </gux-table>`;

  if (!toolbarHtml && !shell) {
    return tableHtml;
  }

  return `<div class="gux-table-shell">
    ${toolbarHtml}
    ${tableHtml}
  </div>`;
};

const renderGuxFieldText = ({
  escapeHtml,
  inputId = "",
  className = "",
  label,
  value = "",
  type = "text",
  placeholder = "",
  attrs = "",
  clearable = true,
}) => {
  const clearableAttr = clearable && type !== "password" && type !== "datetime-local" ? ' clearable="true"' : "";

  return `<div class="field-container">
    <gux-form-field-text-like label-position="above"${clearableAttr}>
      <input slot="input"${inputId ? ` id="${escapeHtml(inputId)}"` : ""} class="${escapeHtml(
        className
      )}" type="${escapeHtml(type)}" value="${escapeHtml(value)}"${
        placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ""
      }${attrs ? ` ${attrs}` : ""} />
      <label slot="label">${escapeHtml(label)}</label>
    </gux-form-field-text-like>
  </div>`;
};

const renderGuxFieldTextarea = ({
  escapeHtml,
  inputId = "",
  className = "",
  label,
  value = "",
  placeholder = "",
  rows = 4,
  attrs = "",
}) =>
  `<div class="field-container">
    <gux-form-field-textarea label-position="above">
      <textarea slot="input"${inputId ? ` id="${escapeHtml(inputId)}"` : ""} class="${escapeHtml(
        className
      )}" rows="${rows}" placeholder="${escapeHtml(placeholder)}"${attrs ? ` ${attrs}` : ""}>${escapeHtml(
        value
      )}</textarea>
      <label slot="label">${escapeHtml(label)}</label>
    </gux-form-field-textarea>
  </div>`;

const parseSelectOptionsHtml = (optionsHtml) => {
  const options = [];
  const pattern = /<option\s+value="([^"]*)"([^>]*)>([\s\S]*?)<\/option>/gi;
  let match = pattern.exec(String(optionsHtml || ""));

  while (match) {
    options.push({
      value: match[1],
      label: match[3].trim(),
      selected: /\sselected(?:\s|>|$)/i.test(match[2]),
    });
    match = pattern.exec(String(optionsHtml || ""));
  }

  return options;
};

const renderGuxFieldSelect = ({
  escapeHtml: escapeHtmlFn,
  inputId = "",
  className = "",
  label,
  optionsHtml = "",
  options = null,
  value = "",
  placeholder = "Select…",
  listboxLabel = "",
  attrs = "",
}) => {
  const safeEscape = escapeHtmlFn || escapeHtml;
  const parsedOptions = Array.isArray(options) ? options : parseSelectOptionsHtml(optionsHtml);
  const selectedValue =
    value !== "" && value != null
      ? String(value)
      : parsedOptions.find((option) => option.selected)?.value || "";

  return renderGuxDropdown({
    escapeHtml: safeEscape,
    inputId,
    className,
    label,
    value: selectedValue,
    options: parsedOptions.map((option) => ({
      value: option.value,
      label: option.label,
    })),
    placeholder,
    listboxLabel: listboxLabel || label,
    attrs,
  });
};

const resolveDropdownChange = (target, classNames) => {
  const classNameList = Array.isArray(classNames) ? classNames : [classNames];
  const matchedClass = resolveFieldClass(target, classNameList);
  if (!matchedClass) {
    return null;
  }

  const control = target.closest(`.${matchedClass}`);
  if (!control) {
    return null;
  }

  const resultId = control.getAttribute("data-result-id");
  const resultEl = resultId ? document.getElementById(resultId) : null;
  const value = readControlValueFromElement(control);

  return {
    matchedClass,
    control,
    resultId,
    resultEl,
    value,
  };
};

const renderGuxFieldCheckbox = ({
  escapeHtml,
  inputId = "",
  className = "",
  label,
  checked = false,
  attrs = "",
  labelPosition = "beside",
}) =>
  `<gux-form-field-checkbox label-position="${escapeHtml(labelPosition)}">
    <input slot="input" type="checkbox"${inputId ? ` id="${escapeHtml(inputId)}"` : ""} class="${escapeHtml(
      className
    )}"${checked ? " checked" : ""}${attrs ? ` ${attrs}` : ""} />
    <label slot="label">${label}</label>
  </gux-form-field-checkbox>`;

const renderGuxDropdownOptions = (options, { escapeHtml, selectedValue = "" } = {}) =>
  options
    .map(
      (option) =>
        `<gux-option value="${escapeHtml(option.value)}"${
          String(option.value) === String(selectedValue) ? " selected" : ""
        }>${escapeHtml(option.label)}</gux-option>`
    )
    .join("");

const renderGuxDropdown = ({
  escapeHtml,
  inputId = "",
  className = "",
  label = "",
  value = "",
  options = [],
  placeholder = "Select…",
  listboxLabel = "",
  attrs = "",
}) => {
  const selectedValue = String(value ?? "");
  const optionHtml = renderGuxDropdownOptions(options, { escapeHtml, selectedValue });

  return `<div class="field-container">
    ${label ? `<label class="field-label"${inputId ? ` for="${escapeHtml(inputId)}"` : ""}>${escapeHtml(label)}</label>` : ""}
    <gux-dropdown${inputId ? ` id="${escapeHtml(inputId)}"` : ""} class="${escapeHtml(
      className
    )}" placeholder="${escapeHtml(placeholder)}"${
      selectedValue ? ` value="${escapeHtml(selectedValue)}"` : ""
    }${attrs ? ` ${attrs}` : ""}>
      <gux-listbox${listboxLabel ? ` aria-label="${escapeHtml(listboxLabel)}"` : ""}>${optionHtml}</gux-listbox>
    </gux-dropdown>
  </div>`;
};

const renderGuxColumnMoveButton = ({
  escapeHtml: escapeHtmlFn,
  className = "column-move-button",
  exportId,
  columnKey,
  direction,
  disabled = false,
}) => {
  const safeEscape = escapeHtmlFn || escapeHtml;
  const isUp = direction === "up";
  const label = isUp ? "Move column up" : "Move column down";

  return `<gux-button class="${safeEscape(className)}" type="button" accent="secondary" gux-title="${safeEscape(
    label
  )}" data-export-id="${safeEscape(exportId)}" data-column-key="${safeEscape(columnKey)}" data-direction="${safeEscape(
    direction
  )}"${disabled ? " disabled" : ""}><gux-icon icon-name="${isUp ? "arrow-up" : "arrow-down"}" decorative></gux-icon></gux-button>`;
};

const renderGuxExportToolbar = ({ escapeHtml: escapeHtmlFn, exportId, showEdit = true }) => {
  const safeEscape = escapeHtmlFn || escapeHtml;
  const editActionHtml = showEdit
    ? `<gux-table-toolbar-custom-action
        accent="secondary"
        class="export-edit-button"
        data-export-id="${safeEscape(exportId)}"
      >
        <span slot="text">Edit Columns</span>
      </gux-table-toolbar-custom-action>`
    : "";

  return renderGuxTableToolbar({
    escapeHtml: safeEscape,
    permanentActionsHtml: `${editActionHtml}<gux-table-toolbar-custom-action
        accent="secondary"
        class="export-download-button"
        data-export-id="${safeEscape(exportId)}"
      >
        <span slot="text">Export CSV</span>
        <gux-icon slot="icon" icon-name="export" decorative></gux-icon>
      </gux-table-toolbar-custom-action>`,
  });
};

const readControlValueFromElement = (control) => {
  if (!control) {
    return "";
  }

  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
    return control.value;
  }

  if (control instanceof HTMLSelectElement) {
    return control.value;
  }

  if ("value" in control && control.value != null) {
    return String(control.value);
  }

  const nestedInput = control.querySelector("input, textarea, select");
  if (
    nestedInput instanceof HTMLInputElement ||
    nestedInput instanceof HTMLTextAreaElement ||
    nestedInput instanceof HTMLSelectElement
  ) {
    return nestedInput.value;
  }

  return "";
};

const readControlValue = (root, className) =>
  readControlValueFromElement(root.querySelector(`.${className}`));

const resolveFieldClass = (target, classNames) => {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  for (const className of classNames) {
    if (target.classList.contains(className)) {
      return className;
    }

    const closest = target.closest(`.${className}`);
    if (closest) {
      return className;
    }
  }

  return null;
};

const getRegionControlValue = (regionControl) => {
  if (!regionControl) {
    return "";
  }

  if (regionControl instanceof HTMLSelectElement) {
    return regionControl.value;
  }

  if ("value" in regionControl && regionControl.value != null) {
    return String(regionControl.value);
  }

  return "";
};

const waitForGuxDropdownSupport = async () => {
  if (typeof customElements === "undefined") {
    return;
  }

  await Promise.all([
    customElements.whenDefined("gux-dropdown"),
    customElements.whenDefined("gux-listbox"),
    customElements.whenDefined("gux-option"),
  ]);
};

const populateRegionControl = async (regionControl, regions, savedRegionId) => {
  if (!regionControl) {
    return;
  }

  const options = (regions || []).map((region) => ({
    value: region.id,
    label: region.label || region.id,
  }));

  if (regionControl instanceof HTMLSelectElement) {
    if (options.length > 0 && regionControl.options.length === 0) {
      regionControl.innerHTML = options
        .map((option) => `<option value="${option.value}">${option.label}</option>`)
        .join("");
    }
    if (savedRegionId) {
      regionControl.value = savedRegionId;
    }
    return;
  }

  await waitForGuxDropdownSupport();

  const existingOptions = regionControl.querySelectorAll("gux-option");
  if (existingOptions.length === 0 && options.length > 0) {
    let listbox = regionControl.querySelector("gux-listbox");
    if (!listbox) {
      listbox = document.createElement("gux-listbox");
      listbox.setAttribute("aria-label", "Genesys regions");
      regionControl.replaceChildren(listbox);
    }

    listbox.innerHTML = renderGuxDropdownOptions(options, {
      escapeHtml,
      selectedValue: savedRegionId,
    });
  }

  if (savedRegionId) {
    regionControl.value = savedRegionId;
  } else {
    regionControl.value = "";
  }
};

const renderGuxTopicMultiSelect = ({
  escapeHtml: escapeHtmlFn,
  className,
  label,
  topics = [],
  resultId = "",
  emptyMessage = "No topics are available for this page.",
}) => {
  const safeEscape = escapeHtmlFn || escapeHtml;
  const selectedTopics = topics.filter((topic) => topic.selected);

  if (!topics.length) {
    return `<div class="field-container notification-topic-picker notification-topic-picker--empty">
      <label class="field-label">${safeEscape(label)}</label>
      <p class="muted">${safeEscape(emptyMessage)}</p>
      <div class="notification-topic-selected">
        <div class="notification-topic-selected__label">Selected topics</div>
        <ul class="notification-topic-selected__list">
          <li class="muted">No topics selected.</li>
        </ul>
      </div>
    </div>`;
  }

  const optionsHtml = topics
    .map((topic) =>
      renderGuxFieldCheckbox({
        escapeHtml: safeEscape,
        className: `${className}-topic-option`,
        label: `<span class="notification-topic-option__id">${safeEscape(topic.id)}</span>${
          topic.description
            ? `<span class="notification-topic-option__description">${safeEscape(topic.description)}</span>`
            : ""
        }`,
        checked: topic.selected,
        attrs: `data-topic-id="${safeEscape(topic.id)}" data-result-id="${safeEscape(
          resultId
        )}" value="${safeEscape(topic.id)}"`,
        labelPosition: "beside",
      })
    )
    .join("");

  return `<div class="field-container notification-topic-picker">
    <label class="field-label">${safeEscape(label)}</label>
    <details class="notification-topic-multiselect ${safeEscape(className)}-multiselect">
      <summary class="notification-topic-multiselect__summary">${safeEscape(
        String(selectedTopics.length)
      )} topic${selectedTopics.length === 1 ? "" : "s"} selected</summary>
      <div class="notification-topic-multiselect__options">${optionsHtml}</div>
    </details>
    <div class="notification-topic-selected">
      <div class="notification-topic-selected__label">Selected topics</div>
      <ul class="notification-topic-selected__list">
        ${
          selectedTopics.length
            ? selectedTopics.map((topic) => `<li><code>${safeEscape(topic.id)}</code></li>`).join("")
            : '<li class="muted">No topics selected.</li>'
        }
      </ul>
    </div>
  </div>`;
};

const readTopicMultiSelectValues = (rootEl, className) => {
  if (!rootEl) {
    return [];
  }

  return Array.from(rootEl.querySelectorAll(`.${className}-topic-option:checked`))
    .map((input) => input.getAttribute("data-topic-id") || input.value)
    .filter(Boolean);
};

export {
  getRegionControlValue,
  parseSelectOptionsHtml,
  populateRegionControl,
  readControlValue,
  readControlValueFromElement,
  readTopicMultiSelectValues,
  renderGuxColumnMoveButton,
  renderGuxDropdown,
  renderGuxDropdownOptions,
  renderGuxExportToolbar,
  renderGuxFieldCheckbox,
  renderGuxFieldSelect,
  renderGuxFieldText,
  renderGuxFieldTextarea,
  renderGuxTopicMultiSelect,
  renderGuxTable,
  renderGuxTableToolbar,
  resolveDropdownChange,
  resolveFieldClass,
};
