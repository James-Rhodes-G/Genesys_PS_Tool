import { appendUserCacheStatus, loadSessionUsers } from "./session-store.js";
import { summarizeBulkStatuses, updateBulkUserSelectionUi } from "./bulk-utils.js";
import { renderLogoffConfirmBody } from "./bulk-confirm.js";
import {
  createBulkUserSelectionHandlers,
  escapeHtml,
  getSelectedUsers,
  renderBulkActionGrid,
} from "./bulk-user-picker.js";

const BULK_KIND = "logoff";
const USER_CHECKBOX_CLASS = "bulk-logoff-user-checkbox";
const USER_FILTER_CLASS = "bulk-logoff-user-filter";

const createBulkLogoffResultsMeta = (resultId, rows, title, status) => ({
  resultId,
  title,
  status,
  exportType: "bulk_logoff",
  rows,
  editMode: false,
  availableColumns: [
    { key: "name", header: "Name" },
    { key: "userName", header: "User Name" },
    { key: "id", header: "ID" },
    { key: "status", header: "Status" },
    { key: "error", header: "Error" },
  ],
  selectedColumnKeys: ["name", "userName", "id", "status", "error"],
});

const renderBulkLogoffBody = (resultId, exportMeta) => {
  const selectedCount = Object.keys(exportMeta.selectedUsersById || {}).length;

  return renderBulkActionGrid({
    resultId,
    exportMeta,
    leftPanelTitle: "User Logoff",
    leftPanelHtml: `<p class="muted">Log off the selected users from the Genesys app session.</p>`,
    applyButtonClass: "bulk-logoff-apply",
    applyButtonLabel: "Log Off Selected Users",
    bulkKind: BULK_KIND,
    userCheckboxClass: USER_CHECKBOX_CLASS,
    userFilterClass: USER_FILTER_CLASS,
    summaryText: `${selectedCount} user(s) selected`,
  });
};

const createBulkLogoffFeature = ({
  state,
  loadSessionUsers: loadUsers = loadSessionUsers,
  logoffUsers,
  requireCredentials,
  startExportResult,
  finishExportResult,
  rerenderExportSection,
  prependExportResult,
  renderLoadingState,
  renderJsonBlock,
  confirmModal,
}) => {
  const refreshSelectionUi = (resultId, exportMeta) => {
    updateBulkUserSelectionUi({
      resultId,
      exportMeta,
      bulkKind: BULK_KIND,
      userCheckboxClass: USER_CHECKBOX_CLASS,
      assignmentLabel: "",
      getAssignmentCount: () => 0,
    });
    const summaryEl = document.getElementById(resultId)?.querySelector(".bulk-selection-summary");
    if (summaryEl) {
      summaryEl.textContent = `${Object.keys(exportMeta.selectedUsersById || {}).length} user(s) selected`;
    }
  };

  const { handleUserSelectionChange } = createBulkUserSelectionHandlers({
    state,
    bulkKind: BULK_KIND,
    userCheckboxClass: USER_CHECKBOX_CLASS,
    userFilterClass: USER_FILTER_CLASS,
    rerenderExportSection,
    refreshSelectionUi,
  });

  const wireButton = (button, { hasConnection }) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!hasConnection()) {
        return;
      }

      const credentials = requireCredentials("User Logoff");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "User Logoff",
        "Loading bulk action data...",
        renderLoadingState("Fetching users...")
      );

      try {
        const { users, cache: userCache } = await loadUsers(credentials);
        const statusBase = `Loaded ${users.length} users`;
        const exportMeta = {
          kind: "bulk-logoff",
          resultId: loadingResultId,
          title: "User Logoff",
          statusBase,
          status: appendUserCacheStatus(statusBase, userCache),
          userCache,
          editable: false,
          users: users.slice().sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""))),
          userFilter: "",
          selectedUsersById: {},
          renderBody: () => renderBulkLogoffBody(loadingResultId, state.exportData[loadingResultId]),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "User Logoff",
          error.message || "User logoff load failed",
          renderJsonBlock(error.payload || { error: error.message || "User logoff load failed" })
        );
      }
    });
  };

  const executeLogoff = async (resultId, exportMeta) => {
    const resultEl = document.getElementById(resultId);
    if (!resultEl || !exportMeta) {
      return;
    }

    const selectedUsers = getSelectedUsers(exportMeta);
    const credentials = requireCredentials("User Logoff");
    if (!credentials) {
      return;
    }

    resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
      `Logging off ${selectedUsers.length} users...`
    );

    try {
      const results = await logoffUsers({
        ...credentials,
        userIds: selectedUsers.map((user) => user.id),
      });

      const resultRows = selectedUsers.map((user) => {
        const logoffResult = results.find((entry) => entry.userId === user.id);
        return {
          name: user.name || "",
          userName: user.userName || user.username || "",
          id: user.id,
          status: logoffResult?.status || "unknown",
          error: logoffResult?.error || "",
        };
      });
      const status = summarizeBulkStatuses(resultRows);

      finishExportResult(
        resultId,
        "User Logoff",
        status,
        "",
        createBulkLogoffResultsMeta(resultId, resultRows, "User Logoff", status)
      );
    } catch (error) {
      finishExportResult(
        resultId,
        "User Logoff",
        error.message || "Bulk logoff failed",
        renderJsonBlock(error.payload || { error: error.message || "Bulk logoff failed" })
      );
    }
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const applyButton = target.closest(".bulk-logoff-apply");
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

    const selectedUsers = getSelectedUsers(exportMeta);
    if (selectedUsers.length === 0) {
      prependExportResult(
        "User Logoff",
        "No users selected",
        '<p class="muted">Select at least one user before logging off.</p>'
      );
      return true;
    }

    confirmModal.open({
      resultId,
      title: "Confirm User Logoff",
      bodyHtml: renderLogoffConfirmBody({ users: selectedUsers }),
      confirmLabel: "Log Off Users",
      onConfirm: async ({ resultId, close }) => {
        const exportMeta = resultId ? state.exportData[resultId] : null;
        if (!exportMeta) {
          close();
          return;
        }
        close();
        await executeLogoff(resultId, exportMeta);
      },
    });
    return true;
  };

  const handleChange = (event) => handleUserSelectionChange(event);

  return { wireButton, handleClick, handleChange };
};

export { createBulkLogoffFeature };
