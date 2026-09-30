import { appendUserCacheStatus, loadSessionUsers } from "./session-store.js";
import {
  createRoleAssignmentEntry,
  filterUsers,
  buildBulkCompletionStatus,
  executeBulkJobWithProgress,
  updateBulkUserSelectionUi,
} from "./bulk-utils.js";
import { renderRoleAssignConfirmBody } from "./bulk-confirm.js";
import {
  renderGuxFieldCheckbox,
  renderGuxFieldSelect,
  renderGuxFieldText,
  resolveDropdownChange,
} from "./gux-ui.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const mapNamedOptions = (items) =>
  (items || [])
    .slice()
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")))
    .map((item) => ({
      value: item.id,
      label: item.name || item.id,
    }));

const getSelectedUsers = (exportMeta) => Object.values(exportMeta.selectedUsersById || {});

const refreshRoleSelectionUi = (resultId, exportMeta) => {
  updateBulkUserSelectionUi({
    resultId,
    exportMeta,
    bulkKind: "role",
    userCheckboxClass: "bulk-role-user-checkbox",
    assignmentLabel: "role assignment(s) queued",
    getAssignmentCount: (meta) => (meta.roleAssignments || []).length,
  });
};

const renderSelectedRoles = (assignments, resultId) => {
  if (!assignments.length) {
    return '<p class="muted">No role assignments added yet. Select a role and division, then add.</p>';
  }

  return `<div class="bulk-skill-options">${assignments
    .map(
      (assignment) => `<div class="bulk-skill-option">
        <div class="bulk-assignment-details">
          <span class="bulk-assignment-name">${escapeHtml(assignment.roleName)}</span>
          <span class="bulk-assignment-meta muted">${escapeHtml(assignment.divisionName)}</span>
        </div>
        <gux-button class="bulk-role-assignment-remove" type="button" accent="secondary" data-result-id="${escapeHtml(
          resultId
        )}" data-assignment-id="${escapeHtml(assignment.id)}">Remove</gux-button>
      </div>`
    )
    .join("")}</div>`;
};

const renderBulkRoleAssignBody = (resultId, exportMeta) => {
  const roleOptionsHtml = (exportMeta.roleOptions || [])
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}"${
          String(option.value) === String(exportMeta.pendingRoleId || "") ? " selected" : ""
        }>${escapeHtml(option.label)}</option>`
    )
    .join("");
  const divisionOptionsHtml = (exportMeta.assignmentDivisionOptions || [])
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}"${
          String(option.value) === String(exportMeta.pendingDivisionId || "") ? " selected" : ""
        }>${escapeHtml(option.label)}</option>`
    )
    .join("");
  const filteredUsers = filterUsers(exportMeta.users || [], exportMeta.userFilter);
  const selectedUserIds = new Set(Object.keys(exportMeta.selectedUsersById || {}));
  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedUserIds.has(user.id));

  const userRowsHtml = filteredUsers
    .map(
      (user) => `<div class="bulk-user-row">${renderGuxFieldCheckbox({
        escapeHtml,
        className: "bulk-role-user-checkbox",
        label: `<span>${escapeHtml(user.name || user.userName || user.id)}</span> <span class="muted">${escapeHtml(
          user.userName || user.username || user.id
        )}</span>`,
        checked: selectedUserIds.has(user.id),
        attrs: `data-result-id="${escapeHtml(resultId)}" data-user-id="${escapeHtml(user.id)}"`,
      })}</div>`
    )
    .join("");

  return `<div class="bulk-skill-grid">
    <div class="bulk-skill-panel">
      <h3>Roles to Assign</h3>
      <div class="bulk-skill-filters call-spoof-form">
        ${renderGuxFieldSelect({
          escapeHtml,
          inputId: `${resultId}-role-id`,
          className: "bulk-role-selection",
          label: "Role",
          optionsHtml: `<option value="">Select Role</option>${roleOptionsHtml}`,
          attrs: `data-result-id="${escapeHtml(resultId)}"`,
        })}
        ${renderGuxFieldSelect({
          escapeHtml,
          inputId: `${resultId}-assignment-division-id`,
          className: "bulk-role-division-selection",
          label: "Assignment Division",
          optionsHtml: `<option value="">Select Division</option>${divisionOptionsHtml}`,
          attrs: `data-result-id="${escapeHtml(resultId)}"`,
        })}
      </div>
      <gux-button class="bulk-role-assignment-add" type="button" accent="secondary" data-result-id="${escapeHtml(
        resultId
      )}">Add Role Assignment</gux-button>
      ${renderSelectedRoles(exportMeta.roleAssignments || [], resultId)}
    </div>
    <div class="bulk-skill-panel">
      <h3>Select Users</h3>
      <div class="bulk-skill-filters call-spoof-form">
        ${renderGuxFieldText({
          escapeHtml,
          inputId: `${resultId}-user-filter`,
          className: "bulk-role-user-filter",
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
        attrs: `data-result-id="${escapeHtml(resultId)}" data-bulk-kind="role"`,
      })}
      <div class="bulk-skill-user-results">${userRowsHtml || '<p class="muted">No users match the current filter.</p>'}</div>
    </div>
  </div>
  <div class="bulk-skill-actions">
    <gux-button class="bulk-role-assign-apply" type="button" accent="primary" data-result-id="${escapeHtml(
      resultId
    )}">Assign Roles to Selected Users</gux-button>
    <span class="muted bulk-selection-summary">${escapeHtml(
      `${selectedUserIds.size} user(s) selected, ${(exportMeta.roleAssignments || []).length} role assignment(s) queued`
    )}</span>
  </div>`;
};

const createBulkRoleAssignResultsMeta = (resultId, rows, title, status) => ({
  resultId,
  title,
  status,
  exportType: "bulk_role_assign",
  rows,
  editMode: false,
  availableColumns: [
    { key: "name", header: "Name" },
    { key: "userName", header: "User Name" },
    { key: "id", header: "ID" },
    { key: "roleName", header: "Role" },
    { key: "divisionName", header: "Division" },
    { key: "status", header: "Status" },
    { key: "error", header: "Error" },
  ],
  selectedColumnKeys: ["name", "userName", "id", "roleName", "divisionName", "status", "error"],
});

const createBulkRoleAssignFeature = ({
  state,
  getRoles,
  getDivisions,
  loadSessionUsers: loadUsers = loadSessionUsers,
  assignUsersToRoleDivisionViaJob,
  requireCredentials,
  startExportResult,
  finishExportResult,
  rerenderExportSection,
  prependExportResult,
  renderLoadingState,
  renderJsonBlock,
  confirmModal,
}) => {
  const wireButton = (button, { hasConnection }) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!hasConnection()) {
        return;
      }

      const credentials = requireCredentials("Bulk Role Assign");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Bulk Role Assign",
        "Loading bulk action data...",
        renderLoadingState("Fetching roles, divisions, and users...")
      );

      try {
        const [roles, divisions, { users, cache: userCache }] = await Promise.all([
          getRoles(credentials),
          getDivisions(credentials),
          loadUsers(credentials),
        ]);
        const statusBase = `Loaded ${users.length} users, ${roles.length} roles, and ${divisions.length} divisions`;
        const exportMeta = {
          kind: "bulk-role-assign",
          resultId: loadingResultId,
          title: "Bulk Role Assign",
          statusBase,
          status: appendUserCacheStatus(statusBase, userCache),
          userCache,
          editable: false,
          roleOptions: mapNamedOptions(roles),
          assignmentDivisionOptions: [{ value: "*", label: "All" }].concat(mapNamedOptions(divisions)),
          users: users.slice().sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""))),
          roleAssignments: [],
          pendingRoleId: "",
          pendingDivisionId: "",
          userFilter: "",
          selectedUsersById: {},
          renderBody: () => renderBulkRoleAssignBody(loadingResultId, state.exportData[loadingResultId]),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Bulk Role Assign",
          error.message || "Bulk role assignment load failed",
          renderJsonBlock(error.payload || { error: error.message || "Bulk role assignment load failed" })
        );
      }
    });
  };

  const executeRoleAssignment = async (resultId, exportMeta) => {
    const resultEl = resultId ? document.getElementById(resultId) : null;
    if (!resultEl || !exportMeta) {
      return;
    }

    const selectedUsers = getSelectedUsers(exportMeta);
    const credentials = requireCredentials("Bulk Role Assign");
    if (!credentials) {
      return;
    }

    const totalItems = selectedUsers.length * exportMeta.roleAssignments.length;

    try {
      const { job, results: assignmentResults } = await executeBulkJobWithProgress({
        resultId,
        exportMeta,
        state,
        totalItems,
        actionMessage: `Assigning ${exportMeta.roleAssignments.length} role assignment(s) to ${selectedUsers.length} user(s)...`,
        cancelLabel: "Cancel Assignment",
        unitLabel: "assignments",
        credentials,
        renderProgressBody: renderBulkRoleAssignBody,
        runJob: (jobOptions) =>
          assignUsersToRoleDivisionViaJob({
            ...jobOptions,
            userIds: selectedUsers.map((user) => user.id),
            roleAssignments: exportMeta.roleAssignments.map((assignment) => ({
              roleId: assignment.roleId,
              divisionId: assignment.divisionId,
            })),
          }),
      });

      const resultRows = [];
      selectedUsers.forEach((user) => {
        exportMeta.roleAssignments.forEach((assignment) => {
          const assignmentResult = assignmentResults.find(
            (entry) =>
              entry.userId === user.id &&
              entry.roleId === assignment.roleId &&
              entry.divisionId === assignment.divisionId
          );
          resultRows.push({
            name: user.name || "",
            userName: user.userName || user.username || "",
            id: user.id,
            roleName: assignment.roleName,
            divisionName: assignment.divisionName,
            status: assignmentResult?.status || "unknown",
            error: assignmentResult?.error || "",
          });
        });
      });

      const status = buildBulkCompletionStatus(resultRows, { job });
      finishExportResult(
        resultId,
        "Bulk Role Assign",
        status,
        "",
        createBulkRoleAssignResultsMeta(resultId, resultRows, "Bulk Role Assign", status)
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        finishExportResult(
          resultId,
          "Bulk Role Assign",
          "Assignment cancelled.",
          '<p class="muted">Role assignment was cancelled before completion.</p>'
        );
        return;
      }

      finishExportResult(
        resultId,
        "Bulk Role Assign",
        error.message || "Bulk role assignment failed",
        renderJsonBlock(error.payload || { error: error.message || "Bulk role assignment failed" })
      );
    }
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const addButton = target.closest(".bulk-role-assignment-add");
    if (addButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = addButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return true;
      }

      if (!exportMeta.pendingRoleId || !exportMeta.pendingDivisionId) {
        prependExportResult(
          "Bulk Role Assign",
          "Role and division required",
          '<p class="muted">Select both a role and a division before adding an assignment.</p>'
        );
        return true;
      }

      const assignment = createRoleAssignmentEntry(
        exportMeta.roleOptions,
        exportMeta.assignmentDivisionOptions,
        exportMeta.pendingRoleId,
        exportMeta.pendingDivisionId
      );

      if (!exportMeta.roleAssignments.some((entry) => entry.id === assignment.id)) {
        exportMeta.roleAssignments.push(assignment);
      }

      exportMeta.pendingRoleId = "";
      exportMeta.pendingDivisionId = "";
      rerenderExportSection(resultId);
      refreshRoleSelectionUi(resultId, exportMeta);
      return true;
    }

    const removeButton = target.closest(".bulk-role-assignment-remove");
    if (removeButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = removeButton.getAttribute("data-result-id");
      const assignmentId = removeButton.getAttribute("data-assignment-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta || !assignmentId) {
        return true;
      }

      exportMeta.roleAssignments = (exportMeta.roleAssignments || []).filter(
        (entry) => entry.id !== assignmentId
      );
      rerenderExportSection(resultId);
      refreshRoleSelectionUi(resultId, exportMeta);
      return true;
    }

    const applyButton = target.closest(".bulk-role-assign-apply");
    if (applyButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = applyButton.getAttribute("data-result-id");
      const resultEl = resultId ? document.getElementById(resultId) : null;
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !resultEl || !exportMeta) {
        return true;
      }

      const selectedUsers = getSelectedUsers(exportMeta);
      if (selectedUsers.length === 0) {
        prependExportResult(
          "Bulk Role Assign",
          "No users selected",
          '<p class="muted">Select at least one user before assigning roles.</p>'
        );
        return true;
      }

      if (!Array.isArray(exportMeta.roleAssignments) || exportMeta.roleAssignments.length === 0) {
        prependExportResult(
          "Bulk Role Assign",
          "No role assignments",
          '<p class="muted">Add at least one role/division assignment before running this action.</p>'
        );
        return true;
      }

      confirmModal.open({
        resultId,
        title: "Confirm Bulk Role Assign",
        bodyHtml: renderRoleAssignConfirmBody({
          roleAssignments: exportMeta.roleAssignments,
          users: selectedUsers,
        }),
        confirmLabel: "Assign Roles",
        onConfirm: async ({ resultId, close }) => {
          const exportMeta = resultId ? state.exportData[resultId] : null;
          if (!exportMeta) {
            close();
            return;
          }

          close();
          await executeRoleAssignment(resultId, exportMeta);
        },
      });
      return true;
    }

    return false;
  };

  const handleChange = (event) => {
    const target = event.target;

    const roleChange = resolveDropdownChange(target, "bulk-role-selection");
    if (roleChange) {
      const exportMeta = roleChange.resultId ? state.exportData[roleChange.resultId] : null;
      if (!roleChange.resultId || !exportMeta) {
        return false;
      }

      exportMeta.pendingRoleId = roleChange.value;
      return true;
    }

    const divisionChange = resolveDropdownChange(target, "bulk-role-division-selection");
    if (divisionChange) {
      const exportMeta = divisionChange.resultId ? state.exportData[divisionChange.resultId] : null;
      if (!divisionChange.resultId || !exportMeta) {
        return false;
      }

      exportMeta.pendingDivisionId = divisionChange.value;
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-role-user-filter")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return false;
      }

      exportMeta.userFilter = target.value;
      rerenderExportSection(resultId);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-role-user-checkbox")) {
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
      refreshRoleSelectionUi(resultId, exportMeta);
      return true;
    }

    if (
      target instanceof HTMLInputElement &&
      target.id.endsWith("-select-all-users") &&
      target.getAttribute("data-bulk-kind") === "role"
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

      refreshRoleSelectionUi(resultId, exportMeta);
      return true;
    }

    return false;
  };

  return { wireButton, handleClick, handleChange };
};

export { createBulkRoleAssignFeature, renderBulkRoleAssignBody };
