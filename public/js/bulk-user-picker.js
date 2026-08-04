import {
  renderGuxFieldCheckbox,
  renderGuxFieldText,
} from "./gux-ui.js";
import {
  filterUsers,
  getSelectedUsers,
  mapNamedOptions,
  updateBulkUserSelectionUi,
} from "./bulk-utils.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderBulkUserRows = (resultId, exportMeta, { bulkKind, userCheckboxClass, renderUserExtra }) => {
  const filteredUsers = filterUsers(exportMeta.users || [], exportMeta.userFilter);
  const selectedUserIds = new Set(Object.keys(exportMeta.selectedUsersById || {}));

  return filteredUsers
    .map((user) => {
      const extraHtml =
        typeof renderUserExtra === "function" ? renderUserExtra(user) : "";

      return `<div class="bulk-user-row">${renderGuxFieldCheckbox({
        escapeHtml,
        className: userCheckboxClass,
        label: `<span>${escapeHtml(user.name || user.userName || user.id)}</span> <span class="muted">${escapeHtml(
          user.userName || user.username || user.id
        )}${extraHtml ? ` · ${extraHtml}` : ""}</span>`,
        checked: selectedUserIds.has(user.id),
        attrs: `data-result-id="${escapeHtml(resultId)}" data-user-id="${escapeHtml(user.id)}"`,
      })}</div>`;
    })
    .join("");
};

const renderBulkActionGrid = ({
  resultId,
  exportMeta,
  leftPanelTitle,
  leftPanelHtml,
  applyButtonClass,
  applyButtonLabel,
  bulkKind,
  userCheckboxClass,
  userFilterClass,
  summaryText,
  renderUserExtra,
}) => {
  const filteredUsers = filterUsers(exportMeta.users || [], exportMeta.userFilter);
  const selectedUserIds = new Set(Object.keys(exportMeta.selectedUsersById || {}));
  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedUserIds.has(user.id));
  const userRowsHtml = renderBulkUserRows(resultId, exportMeta, {
    bulkKind,
    userCheckboxClass,
    renderUserExtra,
  });

  return `<div class="bulk-skill-grid">
    <div class="bulk-skill-panel">
      <h3>${escapeHtml(leftPanelTitle)}</h3>
      ${leftPanelHtml}
    </div>
    <div class="bulk-skill-panel">
      <h3>Select Users</h3>
      <div class="bulk-skill-filters">
        ${renderGuxFieldText({
          escapeHtml,
          inputId: `${resultId}-user-filter`,
          className: userFilterClass,
          label: "Filter by name or username",
          value: exportMeta.userFilter || "",
          placeholder: "Filter users",
          attrs: `data-result-id="${escapeHtml(resultId)}"`,
        })}
      </div>
      ${renderGuxFieldCheckbox({
        escapeHtml,
        inputId: `${resultId}-select-all-users`,
        className: "bulk-select-all-users",
        label: `<span class="bulk-select-all-label">Select All Filtered Users (${filteredUsers.length})</span>`,
        checked: allFilteredSelected,
        attrs: `data-result-id="${escapeHtml(resultId)}" data-bulk-kind="${escapeHtml(bulkKind)}"`,
      })}
      <div class="bulk-skill-user-results">${userRowsHtml || '<p class="muted">No users match the current filter.</p>'}</div>
    </div>
  </div>
  <div class="bulk-skill-actions">
    <gux-button class="${escapeHtml(applyButtonClass)}" type="button" accent="primary" data-result-id="${escapeHtml(
      resultId
    )}">${escapeHtml(applyButtonLabel)}</gux-button>
    <span class="muted bulk-selection-summary">${escapeHtml(summaryText)}</span>
  </div>`;
};

const createBulkUserSelectionHandlers = ({
  state,
  bulkKind,
  userCheckboxClass,
  userFilterClass,
  rerenderExportSection,
  refreshSelectionUi,
  onUserFilterChange,
}) => {
  const handleUserSelectionChange = (event) => {
    const target = event.target;

    if (target instanceof HTMLInputElement && target.classList.contains(userFilterClass)) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return false;
      }

      exportMeta.userFilter = target.value;
      if (typeof onUserFilterChange === "function") {
        onUserFilterChange(exportMeta);
      }
      rerenderExportSection(resultId);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains(userCheckboxClass)) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return false;
      }

      const userId = target.getAttribute("data-user-id");
      const user = (exportMeta.users || []).find((candidate) => candidate.id === userId);
      if (!userId || !user) {
        return true;
      }

      exportMeta.selectedUsersById = { ...(exportMeta.selectedUsersById || {}) };
      if (target.checked) {
        exportMeta.selectedUsersById[userId] = {
          id: user.id,
          name: user.name || "",
          userName: user.userName || user.username || "",
        };
      } else {
        delete exportMeta.selectedUsersById[userId];
      }
      refreshSelectionUi(resultId, exportMeta);
      return true;
    }

    if (
      (target instanceof HTMLInputElement &&
        (target.classList.contains("bulk-select-all-users") || target.id.endsWith("-select-all-users"))) &&
      target.getAttribute("data-bulk-kind") === bulkKind
    ) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return false;
      }

      exportMeta.selectedUsersById = { ...(exportMeta.selectedUsersById || {}) };
      const filteredUsers = filterUsers(exportMeta.users || [], exportMeta.userFilter);

      if (target.checked) {
        filteredUsers.forEach((user) => {
          exportMeta.selectedUsersById[user.id] = {
            id: user.id,
            name: user.name || "",
            userName: user.userName || user.username || "",
          };
        });
      } else {
        filteredUsers.forEach((user) => {
          delete exportMeta.selectedUsersById[user.id];
        });
      }

      refreshSelectionUi(resultId, exportMeta);
      return true;
    }

    return false;
  };

  return { handleUserSelectionChange };
};

export {
  createBulkUserSelectionHandlers,
  escapeHtml,
  getSelectedUsers,
  mapNamedOptions,
  renderBulkActionGrid,
  updateBulkUserSelectionUi,
};
