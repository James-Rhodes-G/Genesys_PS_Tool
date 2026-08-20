import { appendUserCacheStatus, loadSessionUsers } from "./session-store.js";
import { summarizeBulkStatuses, updateBulkUserSelectionUi } from "./bulk-utils.js";
import { renderPhoneBuildConfirmBody } from "./bulk-confirm.js";
import { renderGuxFieldSelect, renderGuxFieldText, resolveDropdownChange } from "./gux-ui.js";
import {
  createBulkUserSelectionHandlers,
  escapeHtml,
  getSelectedUsers,
  mapNamedOptions,
  renderBulkActionGrid,
} from "./bulk-user-picker.js";
import { filterUsersWithoutWebRtcPhone, invalidatePhoneResourceCache, mapPhoneBuildResultsToRows, runPhoneBuildWithProgress } from "./bulk-phone-utils.js";

const BULK_KIND = "phone-build";
const USER_CHECKBOX_CLASS = "bulk-phone-build-user-checkbox";
const USER_FILTER_CLASS = "bulk-phone-build-user-filter";

const createBulkPhoneBuildResultsMeta = (resultId, rows, title, status) => ({
  resultId,
  title,
  status,
  exportType: "bulk_phone_build",
  rows,
  editMode: false,
  availableColumns: [
    { key: "name", header: "Name" },
    { key: "userName", header: "User Name" },
    { key: "id", header: "User ID" },
    { key: "phoneName", header: "Phone Name" },
    { key: "phoneId", header: "Phone ID" },
    { key: "status", header: "Status" },
    { key: "error", header: "Error" },
  ],
  selectedColumnKeys: ["name", "userName", "id", "phoneName", "phoneId", "status", "error"],
});

const renderBulkPhoneBuildBody = (resultId, exportMeta) => {
  const selectedCount = Object.keys(exportMeta.selectedUsersById || {}).length;
  const templateOptionsHtml = (exportMeta.templatePhoneOptions || [])
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}"${
          String(option.value) === String(exportMeta.pendingTemplatePhoneId || "") ? " selected" : ""
        }>${escapeHtml(option.label)}</option>`
    )
    .join("");

  const leftPanelHtml = `<div class="bulk-skill-filters call-spoof-form">
    ${renderGuxFieldSelect({
      escapeHtml,
      inputId: `${resultId}-template-phone-id`,
      className: "bulk-phone-template-selection",
      label: "Template Phone",
      optionsHtml: `<option value="">Select Template Phone</option>${templateOptionsHtml}`,
      attrs: `data-result-id="${escapeHtml(resultId)}"`,
    })}
    ${renderGuxFieldText({
      escapeHtml,
      inputId: `${resultId}-custom-template-phone-id`,
      className: "bulk-phone-template-custom-input",
      label: "Custom Template ID",
      value: exportMeta.customTemplatePhoneId || "",
      placeholder: "Optional template phone ID",
      attrs: `data-result-id="${escapeHtml(resultId)}"`,
    })}
    <p class="muted">Choose a template phone or provide a custom template ID. New phones will be named <code>{user_name}_webRTC</code>. Users who already have a WebRTC phone are not shown.</p>
  </div>`;

  return renderBulkActionGrid({
    resultId,
    exportMeta,
    leftPanelTitle: "Phone Build",
    leftPanelHtml,
    applyButtonClass: "bulk-phone-build-apply",
    applyButtonLabel: "Build Phones for Selected Users",
    bulkKind: BULK_KIND,
    userCheckboxClass: USER_CHECKBOX_CLASS,
    userFilterClass: USER_FILTER_CLASS,
    summaryText: `${selectedCount} user(s) selected`,
  });
};

const createBulkPhoneBuildFeature = ({
  state,
  loadSessionUsers: loadUsers = loadSessionUsers,
  getPhones,
  buildPhones,
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

      const credentials = requireCredentials("Phone Build");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Phone Build",
        "Loading bulk action data...",
        renderLoadingState("Fetching users and phones...")
      );

      try {
        const [{ users, cache: userCache }, phones] = await Promise.all([
          loadUsers(credentials),
          getPhones(credentials),
        ]);
        const eligibleUsers = filterUsersWithoutWebRtcPhone(users, phones);
        const excludedCount = users.length - eligibleUsers.length;
        const statusBase =
          excludedCount > 0
            ? `Loaded ${eligibleUsers.length} users (${excludedCount} already have WebRTC phones)`
            : `Loaded ${eligibleUsers.length} users`;
        const exportMeta = {
          kind: "bulk-phone-build",
          resultId: loadingResultId,
          title: "Phone Build",
          statusBase,
          status: appendUserCacheStatus(statusBase, userCache),
          userCache,
          editable: false,
          users: eligibleUsers
            .slice()
            .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""))),
          templatePhoneOptions: mapNamedOptions(phones),
          pendingTemplatePhoneId: "",
          customTemplatePhoneId: "",
          userFilter: "",
          selectedUsersById: {},
          renderBody: () => renderBulkPhoneBuildBody(loadingResultId, state.exportData[loadingResultId]),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Phone Build",
          error.message || "Phone build load failed",
          renderJsonBlock(error.payload || { error: error.message || "Phone build load failed" })
        );
      }
    });
  };

  const executePhoneBuild = async (resultId, exportMeta, templatePhoneId, selectedUsers) => {
    const resultEl = document.getElementById(resultId);
    if (!resultEl || !exportMeta) {
      return;
    }

    const credentials = requireCredentials("Phone Build");
    if (!credentials) {
      return;
    }

    try {
      const results = await runPhoneBuildWithProgress({
        resultEl,
        users: selectedUsers,
        templatePhoneId,
        buildPhones,
        credentials,
        actionLabel: "Building phones",
      });

      const resultRows = mapPhoneBuildResultsToRows(selectedUsers, results);
      const status = summarizeBulkStatuses(resultRows);

      invalidatePhoneResourceCache();

      finishExportResult(
        resultId,
        "Phone Build",
        status,
        "",
        createBulkPhoneBuildResultsMeta(resultId, resultRows, "Phone Build", status)
      );
    } catch (error) {
      finishExportResult(
        resultId,
        "Phone Build",
        error.message || "Bulk phone build failed",
        renderJsonBlock(error.payload || { error: error.message || "Bulk phone build failed" })
      );
    }
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const applyButton = target.closest(".bulk-phone-build-apply");
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
        "Phone Build",
        "No users selected",
        '<p class="muted">Select at least one user before building phones.</p>'
      );
      return true;
    }

    const templatePhoneId = String(exportMeta.customTemplatePhoneId || exportMeta.pendingTemplatePhoneId || "").trim();
    if (!templatePhoneId) {
      prependExportResult(
        "Phone Build",
        "Template phone required",
        '<p class="muted">Select a template phone or enter a custom template phone ID.</p>'
      );
      return true;
    }

    confirmModal.open({
      resultId,
      title: "Confirm Phone Build",
      bodyHtml: renderPhoneBuildConfirmBody({ templatePhoneId, users: selectedUsers }),
      confirmLabel: "Build Phones",
      onConfirm: async ({ resultId, close }) => {
        const exportMeta = resultId ? state.exportData[resultId] : null;
        if (!exportMeta) {
          close();
          return;
        }
        close();
        await executePhoneBuild(resultId, exportMeta, templatePhoneId, selectedUsers);
      },
    });
    return true;
  };

  const handleChange = (event) => {
    if (handleUserSelectionChange(event)) {
      return true;
    }

    const target = event.target;

    const templateChange = resolveDropdownChange(target, "bulk-phone-template-selection");
    if (templateChange) {
      const exportMeta = templateChange.resultId ? state.exportData[templateChange.resultId] : null;
      if (exportMeta) {
        exportMeta.pendingTemplatePhoneId = templateChange.value;
      }
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-phone-template-custom-input")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (exportMeta) {
        exportMeta.customTemplatePhoneId = target.value;
      }
      return true;
    }

    return false;
  };

  return { wireButton, handleClick, handleChange };
};

export { createBulkPhoneBuildFeature };
