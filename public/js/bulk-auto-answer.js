import { appendUserCacheStatus, loadSessionUsers } from "./session-store.js";
import { renderGuxFieldSelect, resolveDropdownChange, readControlValue } from "./gux-ui.js";
import { buildBulkCompletionStatus, executeBulkJobWithProgress, updateBulkUserSelectionUi } from "./bulk-utils.js";
import { renderAutoAnswerConfirmBody } from "./bulk-confirm.js";
import {
  createBulkUserSelectionHandlers,
  escapeHtml,
  getSelectedUsers,
  renderBulkActionGrid,
} from "./bulk-user-picker.js";

const BULK_KIND = "auto-answer";
const USER_CHECKBOX_CLASS = "bulk-auto-answer-user-checkbox";
const USER_FILTER_CLASS = "bulk-auto-answer-user-filter";

const createBulkAutoAnswerResultsMeta = (resultId, rows, title, status) => ({
  resultId,
  title,
  status,
  exportType: "bulk_auto_answer",
  rows,
  editMode: false,
  availableColumns: [
    { key: "name", header: "Name" },
    { key: "userName", header: "User Name" },
    { key: "id", header: "ID" },
    { key: "previousAutoAnswer", header: "Previous Auto Answer" },
    { key: "newAutoAnswer", header: "New Auto Answer" },
    { key: "status", header: "Status" },
    { key: "error", header: "Error" },
  ],
  selectedColumnKeys: ["name", "userName", "id", "previousAutoAnswer", "newAutoAnswer", "status", "error"],
});

const renderBulkAutoAnswerBody = (resultId, exportMeta) => {
  const selectedCount = Object.keys(exportMeta.selectedUsersById || {}).length;
  const leftPanelHtml = renderGuxFieldSelect({
    escapeHtml,
    inputId: `${resultId}-auto-answer-choice`,
    className: "bulk-auto-answer-choice",
    label: "Auto Answer Value",
    optionsHtml: `<option value="true"${exportMeta.autoAnswerValue ? " selected" : ""}>True</option><option value="false"${exportMeta.autoAnswerValue ? "" : " selected"}>False</option>`,
    attrs: `data-result-id="${escapeHtml(resultId)}"`,
  });

  return renderBulkActionGrid({
    resultId,
    exportMeta,
    leftPanelTitle: "Bulk Auto Answer",
    leftPanelHtml,
    applyButtonClass: "bulk-auto-answer-apply",
    applyButtonLabel: "Apply to Selected Users",
    bulkKind: BULK_KIND,
    userCheckboxClass: USER_CHECKBOX_CLASS,
    userFilterClass: USER_FILTER_CLASS,
    summaryText: `${selectedCount} user(s) selected`,
    renderUserExtra: (user) => `current: ${escapeHtml(String(user.acdAutoAnswer))}`,
  });
};

const createBulkAutoAnswerFeature = ({
  state,
  loadSessionUsers: loadUsers = loadSessionUsers,
  setUsersAutoAnswerViaJob,
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

      const credentials = requireCredentials("Bulk Auto Answer");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Bulk Auto Answer",
        "Loading bulk action data...",
        renderLoadingState("Fetching users...")
      );

      try {
        const { users, cache: userCache } = await loadUsers(credentials);
        const statusBase = `Loaded ${users.length} users`;
        const exportMeta = {
          kind: "bulk-auto-answer",
          resultId: loadingResultId,
          title: "Bulk Auto Answer",
          statusBase,
          status: appendUserCacheStatus(statusBase, userCache),
          userCache,
          editable: false,
          users: users.slice().sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""))),
          autoAnswerValue: true,
          userFilter: "",
          selectedUsersById: {},
          renderBody: () => renderBulkAutoAnswerBody(loadingResultId, state.exportData[loadingResultId]),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Bulk Auto Answer",
          error.message || "Bulk auto answer load failed",
          renderJsonBlock(error.payload || { error: error.message || "Bulk auto answer load failed" })
        );
      }
    });
  };

  const executeAutoAnswer = async (resultId, exportMeta, acdAutoAnswer) => {
    const resultEl = document.getElementById(resultId);
    if (!resultEl || !exportMeta) {
      return;
    }

    const selectedUsers = getSelectedUsers(exportMeta);
    const credentials = requireCredentials("Bulk Auto Answer");
    if (!credentials) {
      return;
    }

    try {
      const { job, results: updateResults } = await executeBulkJobWithProgress({
        resultId,
        exportMeta,
        state,
        totalItems: selectedUsers.length,
        actionMessage: `Updating auto answer for ${selectedUsers.length} user(s)...`,
        cancelLabel: "Cancel Update",
        unitLabel: "users",
        credentials,
        renderProgressBody: renderBulkAutoAnswerBody,
        runJob: (jobOptions) =>
          setUsersAutoAnswerViaJob({
            ...jobOptions,
            userIds: selectedUsers.map((user) => user.id),
            acdAutoAnswer,
          }),
      });

      const resultRows = selectedUsers.map((user) => {
        const updateResult = updateResults.find((entry) => entry.userId === user.id);
        return {
          name: user.name || "",
          userName: user.userName || user.username || "",
          id: user.id,
          previousAutoAnswer: String(user.acdAutoAnswer),
          newAutoAnswer: String(acdAutoAnswer),
          status: updateResult?.status || "unknown",
          error: updateResult?.error || "",
        };
      });
      const status = buildBulkCompletionStatus(resultRows, { job });

      finishExportResult(
        resultId,
        "Bulk Auto Answer",
        status,
        "",
        createBulkAutoAnswerResultsMeta(resultId, resultRows, "Bulk Auto Answer", status)
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        finishExportResult(
          resultId,
          "Bulk Auto Answer",
          "Update cancelled.",
          '<p class="muted">Auto answer update was cancelled before completion.</p>'
        );
        return;
      }

      finishExportResult(
        resultId,
        "Bulk Auto Answer",
        error.message || "Bulk auto answer update failed",
        renderJsonBlock(error.payload || { error: error.message || "Bulk auto answer update failed" })
      );
    }
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const applyButton = target.closest(".bulk-auto-answer-apply");
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
        "Bulk Auto Answer",
        "No users selected",
        '<p class="muted">Select at least one user before applying the change.</p>'
      );
      return true;
    }

    const resultEl = document.getElementById(resultId);
    const acdAutoAnswer = resultEl
      ? readControlValue(resultEl, "bulk-auto-answer-choice") === "true"
      : exportMeta.autoAnswerValue;
    exportMeta.autoAnswerValue = acdAutoAnswer;

    confirmModal.open({
      resultId,
      title: "Confirm Bulk Auto Answer",
      bodyHtml: renderAutoAnswerConfirmBody({ acdAutoAnswer, users: selectedUsers }),
      confirmLabel: "Apply Auto Answer",
      onConfirm: async ({ resultId, close }) => {
        const exportMeta = resultId ? state.exportData[resultId] : null;
        if (!exportMeta) {
          close();
          return;
        }
        close();
        await executeAutoAnswer(resultId, exportMeta, acdAutoAnswer);
      },
    });
    return true;
  };

  const handleChange = (event) => {
    if (handleUserSelectionChange(event)) {
      return true;
    }

    const target = event.target;
    const autoAnswerChange = resolveDropdownChange(target, "bulk-auto-answer-choice");
    if (autoAnswerChange) {
      const exportMeta = autoAnswerChange.resultId ? state.exportData[autoAnswerChange.resultId] : null;
      if (exportMeta) {
        exportMeta.autoAnswerValue = autoAnswerChange.value === "true";
      }
      return true;
    }

    return false;
  };

  return { wireButton, handleClick, handleChange };
};

export { createBulkAutoAnswerFeature };
