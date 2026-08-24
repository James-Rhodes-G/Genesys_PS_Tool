import { readControlValue, renderGuxFieldText } from "./gux-ui.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const filterNamedEntities = (items, filterText, extraKeys = []) => {
  const normalizedFilter = String(filterText || "")
    .trim()
    .toLowerCase();

  if (!normalizedFilter) {
    return (items || []).slice();
  }

  return (items || []).filter((item) => {
    const haystack = [item?.name, item?.id, ...extraKeys.map((key) => item?.[key])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedFilter);
  });
};

const createNotificationEntityPicker = ({
  classPrefix,
  state,
  entityIdLabel,
  entityNameLabel,
  entityIdPlaceholder,
  searchLabel,
  searchPlaceholder,
  itemsKey = "entities",
  formatPrimaryLabel = (item) => item?.name || item?.id || "",
  formatSecondaryLabel = (item) => item?.id || "",
  filterItems = (items, filterText) => filterNamedEntities(items, filterText),
  meAction = null,
}) => {
  const getItems = (exportMeta) => exportMeta?.[itemsKey] || [];

  const renderSelectionList = (resultId, exportMeta) => {
    const items = filterItems(getItems(exportMeta), exportMeta.entityFilter);
    const selectedEntityId = String(exportMeta.entityId || exportMeta.selectedEntityId || "");

    if (!items.length) {
      return '<p class="muted notification-user-selection__empty">No items match the current filter.</p>';
    }

    return `<div class="notification-user-selection__list">
      ${items
        .map((item) => {
          const entityId = String(item?.id || "");
          const isSelected = selectedEntityId === entityId;

          return `<button
            type="button"
            class="notification-user-selection__option${isSelected ? " is-selected" : ""} ${classPrefix}-entity-option"
            data-result-id="${escapeHtml(resultId)}"
            data-entity-id="${escapeHtml(entityId)}"
          >
            <span class="notification-user-selection__option-name">${escapeHtml(formatPrimaryLabel(item))}</span>
            <span class="notification-user-selection__option-username muted">${escapeHtml(formatSecondaryLabel(item))}</span>
          </button>`;
        })
        .join("")}
    </div>`;
  };

  const renderEntityFields = (resultId, exportMeta) => {
    const entityIdValue = exportMeta.entityId || exportMeta.selectedEntityId || "";

    return `<div class="notification-user-selection">
      ${renderGuxFieldText({
        escapeHtml,
        inputId: `${resultId}-${classPrefix}-entity-id`,
        className: `${classPrefix}-entity-id`,
        label: entityIdLabel,
        value: entityIdValue,
        placeholder: entityIdPlaceholder,
        attrs: `data-result-id="${escapeHtml(resultId)}"`,
      })}
      ${
        meAction
          ? `<div class="notification-user-selection__me-action">
              <gux-button class="${classPrefix}-use-me" type="button" accent="secondary" data-result-id="${escapeHtml(
                resultId
              )}">${escapeHtml(meAction.buttonLabel || "Me")}</gux-button>
              <span class="muted">${meAction.hintHtml || ""}</span>
            </div>`
          : ""
      }
      <div class="field-container notification-user-selection__search">
        <label class="field-label" for="${escapeHtml(resultId)}-${classPrefix}-entity-filter">${escapeHtml(
          searchLabel
        )}</label>
        <input
          id="${escapeHtml(resultId)}-${classPrefix}-entity-filter"
          type="search"
          class="${classPrefix}-entity-filter notification-user-selection__filter-input"
          value="${escapeHtml(exportMeta.entityFilter || "")}"
          placeholder="${escapeHtml(searchPlaceholder)}"
          autocomplete="off"
          data-result-id="${escapeHtml(resultId)}"
        />
      </div>
      ${renderSelectionList(resultId, exportMeta)}
      ${
        entityNameLabel
          ? renderGuxFieldText({
              escapeHtml,
              inputId: `${resultId}-${classPrefix}-entity-name`,
              className: `${classPrefix}-entity-name`,
              label: entityNameLabel,
              value: exportMeta.entityName || "",
              placeholder: "Resolved when subscription starts",
              attrs: `readonly data-result-id="${escapeHtml(resultId)}"`,
              clearable: false,
            })
          : ""
      }
    </div>`;
  };

  const readEntityFormState = (resultId, exportMeta, resultEl) => {
    exportMeta.entityFilter = String(readControlValue(resultEl, `${classPrefix}-entity-filter`) || "");
    exportMeta.entityId = String(readControlValue(resultEl, `${classPrefix}-entity-id`) || "").trim();
    exportMeta.selectedEntityId = exportMeta.entityId;
  };

  const syncEntityFields = (resultId, exportMeta) => {
    const resultEl = document.getElementById(resultId);
    if (!resultEl) {
      return;
    }

    const entityIdInput = resultEl.querySelector(`.${classPrefix}-entity-id`);
    const entityNameInput = resultEl.querySelector(`.${classPrefix}-entity-name`);

    if (entityIdInput instanceof HTMLInputElement) {
      entityIdInput.value = exportMeta.entityId || "";
    }

    if (entityNameInput instanceof HTMLInputElement) {
      entityNameInput.value = exportMeta.entityName || "";
    }
  };

  const refreshSelectionList = (resultId, exportMeta) => {
    const resultEl = document.getElementById(resultId);
    const currentList = resultEl?.querySelector(
      ".notification-user-selection__list, .notification-user-selection__empty"
    );

    if (!currentList) {
      return;
    }

    const temp = document.createElement("div");
    temp.innerHTML = renderSelectionList(resultId, exportMeta).trim();
    const nextList = temp.firstElementChild;
    if (nextList) {
      currentList.replaceWith(nextList);
    }
  };

  const findEntity = (exportMeta, entityId) =>
    getItems(exportMeta).find((candidate) => String(candidate?.id || "") === String(entityId || ""));

  const handleEntityInteraction = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const useMeButton = meAction ? target.closest(`.${classPrefix}-use-me`) : null;
    if (useMeButton) {
      event.preventDefault();

      const resultId = useMeButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return true;
      }

      meAction.onSelectMe(exportMeta);
      syncEntityFields(resultId, exportMeta);
      refreshSelectionList(resultId, exportMeta);
      return true;
    }

    const entityOption = target.closest(`.${classPrefix}-entity-option`);
    if (entityOption) {
      event.preventDefault();

      const resultId = entityOption.getAttribute("data-result-id");
      const entityId = entityOption.getAttribute("data-entity-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta || !entityId) {
        return true;
      }

      const entity = findEntity(exportMeta, entityId);
      exportMeta.entityId = entityId;
      exportMeta.selectedEntityId = entityId;
      exportMeta.entityName = formatPrimaryLabel(entity);
      syncEntityFields(resultId, exportMeta);
      refreshSelectionList(resultId, exportMeta);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains(`${classPrefix}-entity-filter`)) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return false;
      }

      exportMeta.entityFilter = target.value;
      refreshSelectionList(resultId, exportMeta);
      return true;
    }

    return false;
  };

  const wrapFeature = (feature) => ({
    ...feature,
    handleInput: (event) => handleEntityInteraction(event),
  });

  return {
    filterNamedEntities,
    renderEntityFields,
    readEntityFormState,
    handleEntityInteraction,
    wrapFeature,
    findEntity,
    formatPrimaryLabel,
  };
};

export { createNotificationEntityPicker, escapeHtml, filterNamedEntities };
