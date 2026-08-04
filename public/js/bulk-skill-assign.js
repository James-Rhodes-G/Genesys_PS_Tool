import { appendUserCacheStatus, loadSessionUsers } from "./session-store.js";
import {
  createSkillAssignmentEntry,
  filterUsers,
  summarizeBulkStatuses,
  updateBulkUserSelectionUi,
} from "./bulk-utils.js";
import { renderSkillAssignConfirmBody } from "./bulk-confirm.js";
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

const refreshSkillSelectionUi = (resultId, exportMeta) => {
  updateBulkUserSelectionUi({
    resultId,
    exportMeta,
    bulkKind: "skill",
    userCheckboxClass: "bulk-skill-user-checkbox",
    assignmentLabel: "skill assignment(s) queued",
    getAssignmentCount: (meta) => (meta.skillAssignments || []).length,
  });
};

const renderSelectedSkills = (assignments, resultId) => {
  if (!assignments.length) {
    return '<p class="muted">No skills selected yet. Add one or more skills with proficiency.</p>';
  }

  return `<div class="bulk-skill-options">${assignments
    .map(
      (assignment) => `<div class="bulk-skill-option">
        <div class="bulk-assignment-details">
          <span class="bulk-assignment-name">${escapeHtml(assignment.skillName)}</span>
          <span class="bulk-assignment-meta muted">Proficiency ${escapeHtml(assignment.proficiency)}</span>
        </div>
        <gux-button class="bulk-skill-assignment-remove" type="button" accent="secondary" data-result-id="${escapeHtml(
          resultId
        )}" data-assignment-id="${escapeHtml(assignment.id)}">Remove</gux-button>
      </div>`
    )
    .join("")}</div>`;
};

const renderBulkSkillAssignBody = (resultId, exportMeta) => {
  const skillOptionsHtml = (exportMeta.skillOptions || [])
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}"${
          String(option.value) === String(exportMeta.pendingSkillId || "") ? " selected" : ""
        }>${escapeHtml(option.label)}</option>`
    )
    .join("");
  const proficiencyOptionsHtml = [0, 1, 2, 3, 4, 5]
    .map(
      (value) =>
        `<option value="${value}"${
          String(value) === String(exportMeta.pendingProficiency ?? 0) ? " selected" : ""
        }>${value}</option>`
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
        className: "bulk-skill-user-checkbox",
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
      <h3>Skills to Assign</h3>
      <div class="bulk-skill-filters call-spoof-form">
        ${renderGuxFieldSelect({
          escapeHtml,
          inputId: `${resultId}-skill-id`,
          className: "bulk-skill-selection",
          label: "Skill",
          optionsHtml: `<option value="">Select Skill</option>${skillOptionsHtml}`,
          attrs: `data-result-id="${escapeHtml(resultId)}"`,
        })}
        ${renderGuxFieldSelect({
          escapeHtml,
          inputId: `${resultId}-skill-proficiency`,
          className: "bulk-skill-proficiency-selection",
          label: "Proficiency",
          optionsHtml: proficiencyOptionsHtml,
          attrs: `data-result-id="${escapeHtml(resultId)}"`,
        })}
      </div>
      <gux-button class="bulk-skill-assignment-add" type="button" accent="secondary" data-result-id="${escapeHtml(
        resultId
      )}">Add Skill Assignment</gux-button>
      ${renderSelectedSkills(exportMeta.skillAssignments || [], resultId)}
    </div>
    <div class="bulk-skill-panel">
      <h3>Select Users</h3>
      <div class="bulk-skill-filters call-spoof-form">
        ${renderGuxFieldText({
          escapeHtml,
          inputId: `${resultId}-user-filter`,
          className: "bulk-skill-user-filter",
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
        attrs: `data-result-id="${escapeHtml(resultId)}" data-bulk-kind="skill"`,
      })}
      <div class="bulk-skill-user-results">${userRowsHtml || '<p class="muted">No users match the current filter.</p>'}</div>
    </div>
  </div>
  <div class="bulk-skill-actions">
    <gux-button class="bulk-skill-assign-apply" type="button" accent="primary" data-result-id="${escapeHtml(
      resultId
    )}">Assign Skills to Selected Users</gux-button>
    <span class="muted bulk-selection-summary">${escapeHtml(
      `${selectedUserIds.size} user(s) selected, ${(exportMeta.skillAssignments || []).length} skill assignment(s) queued`
    )}</span>
  </div>`;
};

const createBulkSkillAssignResultsMeta = (resultId, rows, title, status) => ({
  resultId,
  title,
  status,
  exportType: "bulk_skill_assign",
  rows,
  editMode: false,
  availableColumns: [
    { key: "name", header: "Name" },
    { key: "userName", header: "User Name" },
    { key: "id", header: "ID" },
    { key: "skillName", header: "Skill" },
    { key: "proficiency", header: "Proficiency" },
    { key: "status", header: "Status" },
    { key: "error", header: "Error" },
  ],
  selectedColumnKeys: ["name", "userName", "id", "skillName", "proficiency", "status", "error"],
});

const createBulkSkillAssignFeature = ({
  state,
  getSkills,
  loadSessionUsers: loadUsers = loadSessionUsers,
  assignRoutingSkillsToUsers,
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

      const credentials = requireCredentials("Bulk Skill Assign");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Bulk Skill Assign",
        "Loading bulk action data...",
        renderLoadingState('Fetching skills and users...')
      );

      try {
        const [skills, { users, cache: userCache }] = await Promise.all([
          getSkills(credentials),
          loadUsers(credentials),
        ]);
        const statusBase = `Loaded ${users.length} users and ${skills.length} skills`;
        const exportMeta = {
          kind: "bulk-skill-assign",
          resultId: loadingResultId,
          title: "Bulk Skill Assign",
          statusBase,
          status: appendUserCacheStatus(statusBase, userCache),
          userCache,
          editable: false,
          skillOptions: mapNamedOptions(skills),
          users: users.slice().sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""))),
          skillAssignments: [],
          pendingSkillId: "",
          pendingProficiency: 0,
          userFilter: "",
          selectedUsersById: {},
          renderBody: () => renderBulkSkillAssignBody(loadingResultId, state.exportData[loadingResultId]),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Bulk Skill Assign",
          error.message || "Bulk skill assignment load failed",
          renderJsonBlock(error.payload || { error: error.message || "Bulk skill assignment load failed" })
        );
      }
    });
  };

  const executeSkillAssignment = async (resultId, exportMeta) => {
    const resultEl = resultId ? document.getElementById(resultId) : null;
    if (!resultEl || !exportMeta) {
      return;
    }

    const selectedUsers = getSelectedUsers(exportMeta);
    const credentials = requireCredentials("Bulk Skill Assign");
    if (!credentials) {
      return;
    }

    resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
      `Assigning ${exportMeta.skillAssignments.length} skills to ${selectedUsers.length} users...`
    );

    try {
      const assignmentResults = await assignRoutingSkillsToUsers({
        ...credentials,
        userIds: selectedUsers.map((user) => user.id),
        skills: exportMeta.skillAssignments.map((assignment) => ({
          id: assignment.skillId,
          proficiency: assignment.proficiency,
        })),
      });

      const resultRows = [];
      selectedUsers.forEach((user) => {
        const userResult = assignmentResults.find((entry) => entry.userId === user.id);
        exportMeta.skillAssignments.forEach((assignment) => {
          resultRows.push({
            name: user.name || "",
            userName: user.userName || user.username || "",
            id: user.id,
            skillName: assignment.skillName,
            proficiency: assignment.proficiency,
            status: userResult?.status || "unknown",
            error: userResult?.error || "",
          });
        });
      });
      const status = summarizeBulkStatuses(resultRows);

      finishExportResult(
        resultId,
        "Bulk Skill Assign",
        status,
        "",
        createBulkSkillAssignResultsMeta(resultId, resultRows, "Bulk Skill Assign", status)
      );
    } catch (error) {
      finishExportResult(
        resultId,
        "Bulk Skill Assign",
        error.message || "Bulk skill assignment failed",
        renderJsonBlock(error.payload || { error: error.message || "Bulk skill assignment failed" })
      );
    }
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const addButton = target.closest(".bulk-skill-assignment-add");
    if (addButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = addButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return true;
      }

      if (!exportMeta.pendingSkillId) {
        prependExportResult(
          "Bulk Skill Assign",
          "Skill required",
          '<p class="muted">Select a skill before adding an assignment.</p>'
        );
        return true;
      }

      const assignment = createSkillAssignmentEntry(
        exportMeta.skillOptions,
        exportMeta.pendingSkillId,
        exportMeta.pendingProficiency
      );
      exportMeta.skillAssignments = (exportMeta.skillAssignments || []).filter(
        (entry) => entry.skillId !== assignment.skillId
      );
      exportMeta.skillAssignments.push(assignment);
      exportMeta.pendingSkillId = "";
      exportMeta.pendingProficiency = 0;
      rerenderExportSection(resultId);
      refreshSkillSelectionUi(resultId, exportMeta);
      return true;
    }

    const removeButton = target.closest(".bulk-skill-assignment-remove");
    if (removeButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = removeButton.getAttribute("data-result-id");
      const assignmentId = removeButton.getAttribute("data-assignment-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta || !assignmentId) {
        return true;
      }

      exportMeta.skillAssignments = (exportMeta.skillAssignments || []).filter(
        (entry) => entry.id !== assignmentId
      );
      rerenderExportSection(resultId);
      refreshSkillSelectionUi(resultId, exportMeta);
      return true;
    }

    const applyButton = target.closest(".bulk-skill-assign-apply");
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
          "Bulk Skill Assign",
          "No users selected",
          '<p class="muted">Select at least one user before assigning skills.</p>'
        );
        return true;
      }

      if (!Array.isArray(exportMeta.skillAssignments) || exportMeta.skillAssignments.length === 0) {
        prependExportResult(
          "Bulk Skill Assign",
          "No skill assignments",
          '<p class="muted">Add at least one skill/proficiency assignment before running this action.</p>'
        );
        return true;
      }

      confirmModal.open({
        resultId,
        title: "Confirm Bulk Skill Assign",
        bodyHtml: renderSkillAssignConfirmBody({
          skillAssignments: exportMeta.skillAssignments,
          users: selectedUsers,
        }),
        confirmLabel: "Assign Skills",
        onConfirm: async ({ resultId, close }) => {
          const exportMeta = resultId ? state.exportData[resultId] : null;
          if (!exportMeta) {
            close();
            return;
          }

          close();
          await executeSkillAssignment(resultId, exportMeta);
        },
      });
      return true;
    }

    return false;
  };

  const handleChange = (event) => {
    const target = event.target;

    const skillChange = resolveDropdownChange(target, "bulk-skill-selection");
    if (skillChange) {
      const exportMeta = skillChange.resultId ? state.exportData[skillChange.resultId] : null;
      if (!skillChange.resultId || !exportMeta) {
        return false;
      }

      exportMeta.pendingSkillId = skillChange.value;
      return true;
    }

    const proficiencyChange = resolveDropdownChange(target, "bulk-skill-proficiency-selection");
    if (proficiencyChange) {
      const exportMeta = proficiencyChange.resultId ? state.exportData[proficiencyChange.resultId] : null;
      if (!proficiencyChange.resultId || !exportMeta) {
        return false;
      }

      exportMeta.pendingProficiency = Number(proficiencyChange.value);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-skill-user-filter")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return false;
      }

      exportMeta.userFilter = target.value;
      rerenderExportSection(resultId);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-skill-user-checkbox")) {
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
      refreshSkillSelectionUi(resultId, exportMeta);
      return true;
    }

    if (target instanceof HTMLInputElement && target.id.endsWith("-select-all-users") && target.getAttribute("data-bulk-kind") === "skill") {
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

      refreshSkillSelectionUi(resultId, exportMeta);
      return true;
    }

    return false;
  };

  return { wireButton, handleClick, handleChange };
};

export { createBulkSkillAssignFeature, renderBulkSkillAssignBody };
