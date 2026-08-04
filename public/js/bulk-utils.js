const createRoleAssignmentEntry = (roleOptions, divisionOptions, roleId, divisionId) => {
  const role = (roleOptions || []).find((option) => option.value === roleId);
  const division = (divisionOptions || []).find((option) => option.value === divisionId);

  return {
    id: `${roleId}:${divisionId}`,
    roleId,
    divisionId,
    roleName: role?.label || roleId,
    divisionName: division?.label || divisionId,
  };
};

const createSkillAssignmentEntry = (skillOptions, skillId, proficiency) => {
  const skill = (skillOptions || []).find((option) => option.value === skillId);

  return {
    id: `${skillId}:${proficiency}`,
    skillId,
    skillName: skill?.label || skillId,
    proficiency: Number(proficiency),
  };
};

const summarizeBulkStatuses = (rows) => {
  const successCount = rows.filter((row) => row.status === "success").length;
  const failedCount = rows.filter((row) => row.status === "failed").length;
  const unknownCount = rows.length - successCount - failedCount;

  if (failedCount > 0 || unknownCount > 0) {
    return `${successCount}/${rows.length} succeeded, ${failedCount} failed${
      unknownCount > 0 ? `, ${unknownCount} unknown` : ""
    }`;
  }

  return `Updated ${successCount} records`;
};

const filterUsers = (users, filterText) => {
  const normalizedFilter = String(filterText || "")
    .trim()
    .toLowerCase();

  if (!normalizedFilter) {
    return users;
  }

  return users.filter((user) => {
    const haystack = [user.name, user.userName, user.username, user.id]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedFilter);
  });
};

const mapNamedOptions = (items) =>
  (items || [])
    .slice()
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")))
    .map((item) => ({
      value: item.id,
      label: item.name || item.id,
    }));

const getSelectedUsers = (exportMeta) => Object.values(exportMeta.selectedUsersById || {});

const updateBulkUserSelectionUi = ({
  resultId,
  exportMeta,
  bulkKind,
  userCheckboxClass,
  assignmentLabel,
  getAssignmentCount,
}) => {
  const resultEl = document.getElementById(resultId);
  if (!resultEl || !exportMeta) {
    return;
  }

  const selectedCount = Object.keys(exportMeta.selectedUsersById || {}).length;
  const assignmentCount = getAssignmentCount(exportMeta);
  const filteredUsers = filterUsers(exportMeta.users || [], exportMeta.userFilter);
  const selectedUserIds = new Set(Object.keys(exportMeta.selectedUsersById || {}));
  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedUserIds.has(user.id));

  const summaryEl = resultEl.querySelector(".bulk-selection-summary");
  if (summaryEl) {
    summaryEl.textContent = `${selectedCount} user(s) selected, ${assignmentCount} ${assignmentLabel}`;
  }

  const selectAllEl = resultEl.querySelector(
    `[data-bulk-kind="${bulkKind}"][id$="-select-all-users"]`
  );
  if (selectAllEl instanceof HTMLInputElement) {
    selectAllEl.checked = allFilteredSelected;
  }

  const selectAllLabel = resultEl.querySelector(".bulk-select-all-label");
  if (selectAllLabel) {
    selectAllLabel.textContent = `Select All Filtered Users (${filteredUsers.length})`;
  }

  if (userCheckboxClass) {
    resultEl.querySelectorAll(`.${userCheckboxClass}`).forEach((checkbox) => {
      if (!(checkbox instanceof HTMLInputElement)) {
        return;
      }

      const userId = checkbox.getAttribute("data-user-id");
      checkbox.checked = Boolean(userId && selectedUserIds.has(userId));
    });
  }
};

const captureBulkUserListScroll = (root) =>
  Array.from(root.querySelectorAll(".bulk-skill-user-results")).map((element) => element.scrollTop);

const restoreBulkUserListScroll = (root, scrollTops) => {
  Array.from(root.querySelectorAll(".bulk-skill-user-results")).forEach((element, index) => {
    if (scrollTops[index] != null) {
      element.scrollTop = scrollTops[index];
    }
  });
};

export {
  captureBulkUserListScroll,
  createRoleAssignmentEntry,
  createSkillAssignmentEntry,
  filterUsers,
  getSelectedUsers,
  mapNamedOptions,
  restoreBulkUserListScroll,
  summarizeBulkStatuses,
  updateBulkUserSelectionUi,
};
