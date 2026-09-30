import { appendUserCacheStatus, loadSessionUsers } from "./session-store.js";
import { buildBulkCompletionStatus, executeBulkJobWithProgress, updateBulkUserSelectionUi } from "./bulk-utils.js";
import { renderPasswordResetConfirmBody } from "./bulk-confirm.js";
import {
  renderGuxFieldCheckbox,
  renderGuxFieldSelect,
  renderGuxFieldText,
  resolveDropdownChange,
} from "./gux-ui.js";
import {
  createBulkUserSelectionHandlers,
  escapeHtml,
  getSelectedUsers,
  renderBulkActionGrid,
} from "./bulk-user-picker.js";

const BULK_KIND = "password-reset";
const USER_CHECKBOX_CLASS = "bulk-password-reset-user-checkbox";
const USER_FILTER_CLASS = "bulk-password-reset-user-filter";

const createBulkPasswordResetResultsMeta = (resultId, rows, title, status, { includePasswords = false } = {}) => ({
  resultId,
  title,
  status,
  exportType: "bulk_password_reset",
  rows,
  editMode: false,
  availableColumns: [
    { key: "name", header: "Name" },
    { key: "userName", header: "User Name" },
    { key: "id", header: "ID" },
    { key: "mode", header: "Mode" },
    { key: "password", header: "Password" },
    { key: "status", header: "Status" },
    { key: "error", header: "Error" },
  ],
  selectedColumnKeys: [
    "name",
    "userName",
    "id",
    "mode",
    ...(includePasswords ? ["password"] : []),
    "status",
    "error",
  ],
});

const renderBulkPasswordResetBody = (resultId, exportMeta) => {
  const selectedCount = Object.keys(exportMeta.selectedUsersById || {}).length;
  const mode = exportMeta.passwordMode || "manual";
  const showGeneratedPasswords = Boolean(exportMeta.includeGeneratedPasswords);
  const validationErrors = Array.isArray(exportMeta.passwordValidationErrors)
    ? exportMeta.passwordValidationErrors
    : [];
  const policySummary = exportMeta.passwordPolicyDescription || "Password policy unavailable.";
  const policyWarning = exportMeta.passwordPolicyWarning
    ? `<p class="muted">${escapeHtml(exportMeta.passwordPolicyWarning)}</p>`
    : "";
  const validationHtml = validationErrors.length
    ? `<p class="muted">${escapeHtml(validationErrors.join(" "))}</p>`
    : "";

  const leftPanelHtml = `<div class="bulk-skill-filters call-spoof-form">
    ${renderGuxFieldSelect({
      escapeHtml,
      inputId: `${resultId}-password-mode`,
      className: "bulk-password-mode-selection",
      label: "Mode",
      optionsHtml: `<option value="manual"${mode === "manual" ? " selected" : ""}>Set One Password</option><option value="random"${mode === "random" ? " selected" : ""}>Random Per User</option>`,
      attrs: `data-result-id="${escapeHtml(resultId)}"`,
    })}
    ${
      mode === "manual"
        ? `${renderGuxFieldText({
            escapeHtml,
            inputId: `${resultId}-password`,
            className: "bulk-password-input",
            label: "New Password",
            type: "password",
            value: exportMeta.manualPassword || "",
            placeholder: "New password",
            clearable: false,
            attrs: `data-result-id="${escapeHtml(resultId)}"`,
          })}${renderGuxFieldText({
            escapeHtml,
            inputId: `${resultId}-password-confirm`,
            className: "bulk-password-confirm-input",
            label: "Confirm Password",
            type: "password",
            value: exportMeta.confirmPassword || "",
            placeholder: "Confirm password",
            clearable: false,
            attrs: `data-result-id="${escapeHtml(resultId)}"`,
          })}`
        : renderGuxFieldCheckbox({
            escapeHtml,
            className: "bulk-password-include-generated",
            label: "Include generated passwords in results/CSV",
            checked: showGeneratedPasswords,
            attrs: `data-result-id="${escapeHtml(resultId)}"`,
          })
    }
    <p class="muted">Policy: ${escapeHtml(policySummary)}</p>
    ${policyWarning}
    ${validationHtml}
  </div>`;

  return renderBulkActionGrid({
    resultId,
    exportMeta,
    leftPanelTitle: "Bulk Password Reset",
    leftPanelHtml,
    applyButtonClass: "bulk-password-reset-apply",
    applyButtonLabel: "Reset Passwords for Selected Users",
    bulkKind: BULK_KIND,
    userCheckboxClass: USER_CHECKBOX_CLASS,
    userFilterClass: USER_FILTER_CLASS,
    summaryText: `${selectedCount} user(s) selected`,
  });
};

const createBulkPasswordResetFeature = ({
  state,
  loadSessionUsers: loadUsers = loadSessionUsers,
  getPasswordPolicy,
  resetUsersPasswordsViaJob,
  passwordResetWorkflow,
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

      const credentials = requireCredentials("Bulk Password Reset");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Bulk Password Reset",
        "Loading bulk action data...",
        renderLoadingState("Fetching users and password policy...")
      );

      try {
        const [{ users, cache: userCache }, policyPayload] = await Promise.all([
          loadUsers(credentials),
          getPasswordPolicy(credentials),
        ]);
        const extraState = passwordResetWorkflow.buildExtraState(policyPayload);
        const statusBase = `Loaded ${users.length} users`;
        const exportMeta = {
          ...extraState,
          resultId: loadingResultId,
          title: "Bulk Password Reset",
          statusBase,
          status: appendUserCacheStatus(statusBase, userCache),
          userCache,
          editable: false,
          users: users.slice().sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""))),
          userFilter: "",
          selectedUsersById: {},
          renderBody: () => renderBulkPasswordResetBody(loadingResultId, state.exportData[loadingResultId]),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Bulk Password Reset",
          error.message || "Bulk password reset load failed",
          renderJsonBlock(error.payload || { error: error.message || "Bulk password reset load failed" })
        );
      }
    });
  };

  const executePasswordReset = async (resultId, exportMeta, plan) => {
    const resultEl = document.getElementById(resultId);
    if (!resultEl || !exportMeta) {
      return;
    }

    const credentials = requireCredentials("Bulk Password Reset");
    if (!credentials) {
      return;
    }

    try {
      const { job, results } = await executeBulkJobWithProgress({
        resultId,
        exportMeta,
        state,
        totalItems: plan.passwordResets.length,
        actionMessage: `Resetting passwords for ${plan.passwordResets.length} user(s)...`,
        cancelLabel: "Cancel Reset",
        unitLabel: "users",
        credentials,
        renderProgressBody: renderBulkPasswordResetBody,
        runJob: (jobOptions) =>
          resetUsersPasswordsViaJob({
            ...jobOptions,
            passwordResets: plan.passwordResets.map((entry) => ({
              userId: entry.userId,
              newPassword: entry.newPassword,
            })),
          }),
      });

      const resultRows = plan.resultRows.map((row) => {
        const resetResult = results.find((entry) => entry.userId === row.id);
        return {
          ...row,
          status: resetResult?.status || "unknown",
          error: resetResult?.error || "",
        };
      });
      const status = buildBulkCompletionStatus(resultRows, { job });

      finishExportResult(
        resultId,
        "Bulk Password Reset",
        status,
        "",
        createBulkPasswordResetResultsMeta(resultId, resultRows, "Bulk Password Reset", status, {
          includePasswords: plan.includePasswords,
        })
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        finishExportResult(
          resultId,
          "Bulk Password Reset",
          "Reset cancelled.",
          '<p class="muted">Password reset was cancelled before completion.</p>'
        );
        return;
      }

      finishExportResult(
        resultId,
        "Bulk Password Reset",
        error.message || "Bulk password reset failed",
        renderJsonBlock(error.payload || { error: error.message || "Bulk password reset failed" })
      );
    }
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const applyButton = target.closest(".bulk-password-reset-apply");
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
        "Bulk Password Reset",
        "No users selected",
        '<p class="muted">Select at least one user before resetting passwords.</p>'
      );
      return true;
    }

    let plan;
    try {
      plan = passwordResetWorkflow.buildPlan(exportMeta, selectedUsers);
    } catch (error) {
      prependExportResult(
        "Bulk Password Reset",
        error.message || "Password validation failed",
        renderJsonBlock({ error: error.message || "Password validation failed", details: error.details || null })
      );
      rerenderExportSection(resultId);
      return true;
    }

    confirmModal.open({
      resultId,
      title: "Confirm Password Reset",
      bodyHtml: renderPasswordResetConfirmBody({ plan, users: selectedUsers }),
      confirmLabel: "Reset Passwords",
      onConfirm: async ({ resultId, close }) => {
        const exportMeta = resultId ? state.exportData[resultId] : null;
        if (!exportMeta) {
          close();
          return;
        }
        close();
        await executePasswordReset(resultId, exportMeta, plan);
      },
    });
    return true;
  };

  const handleChange = (event) => {
    if (handleUserSelectionChange(event)) {
      return true;
    }

    const target = event.target;

    const modeChange = resolveDropdownChange(target, "bulk-password-mode-selection");
    if (modeChange) {
      const exportMeta = modeChange.resultId ? state.exportData[modeChange.resultId] : null;
      if (!modeChange.resultId || !exportMeta) {
        return false;
      }

      exportMeta.passwordMode = modeChange.value;
      exportMeta.passwordValidationErrors = [];
      rerenderExportSection(modeChange.resultId);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-password-input")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return false;
      }

      exportMeta.manualPassword = target.value;
      passwordResetWorkflow.updateValidation(exportMeta);
      rerenderExportSection(resultId);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-password-confirm-input")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return false;
      }

      exportMeta.confirmPassword = target.value;
      passwordResetWorkflow.updateValidation(exportMeta);
      rerenderExportSection(resultId);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-password-include-generated")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (exportMeta) {
        exportMeta.includeGeneratedPasswords = target.checked;
      }
      return true;
    }

    return false;
  };

  return { wireButton, handleClick, handleChange };
};

export { createBulkPasswordResetFeature };
