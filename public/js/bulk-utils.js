import { applyExportProgress, yieldToUi } from "./export-progress.js";

const formatBulkProgressGuidance = ({ completed, total, successCount, failedCount, unitLabel = "items" }) => {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeCompleted = Math.max(0, Math.min(Number(completed) || 0, safeTotal));
  const percent = safeTotal > 0 ? Math.round((safeCompleted / safeTotal) * 100) : 0;

  return `${safeCompleted} / ${safeTotal} ${unitLabel} (${percent}%) — ${successCount} succeeded, ${failedCount} failed`;
};

const buildJobSnapshotProgress = (jobSnapshot, totalItems, { message, unitLabel = "items" } = {}) => {
  const total = Number(jobSnapshot?.total) || totalItems || 0;
  const successCount = Number(jobSnapshot?.completed) || 0;
  const failedCount = Number(jobSnapshot?.failed) || 0;
  const processed = successCount + failedCount;
  const processing = Number(jobSnapshot?.processing) || 0;

  let detail = formatBulkProgressGuidance({
    completed: processed,
    total,
    successCount,
    failedCount,
    unitLabel,
  });

  if (processing > 0) {
    detail += ` — ${processing} in progress`;
  }

  return {
    message,
    current: processed,
    total,
    detail,
  };
};

const executeBulkJobWithProgress = async ({
  resultId,
  exportMeta,
  state,
  totalItems,
  actionMessage,
  cancelLabel = "Cancel",
  unitLabel = "items",
  credentials,
  runJob,
  renderProgressBody,
  inProgressKey = "bulkJobInProgress",
  progressHtmlKey = "bulkJobProgressHtml",
}) => {
  const controller = new AbortController();
  state.activeExports[resultId] = controller;

  const previousRenderBody = exportMeta.renderBody;
  const clearState = () => {
    exportMeta[inProgressKey] = false;
    exportMeta[progressHtmlKey] = null;
    exportMeta.renderBody = previousRenderBody;
  };

  exportMeta[inProgressKey] = true;
  if (typeof renderProgressBody === "function") {
    exportMeta.renderBody = () =>
      exportMeta[progressHtmlKey] || renderProgressBody(resultId, state.exportData[resultId] || exportMeta);
  }

  const progressOptions = { cancellable: true, cancelLabel };

  const renderProgress = (jobSnapshot) => {
    applyExportProgress(
      resultId,
      buildJobSnapshotProgress(jobSnapshot, totalItems, { message: actionMessage, unitLabel }),
      progressOptions
    );
    exportMeta[progressHtmlKey] = document.getElementById(resultId)?.querySelector(".export-results__body")?.innerHTML;
  };

  renderProgress({ total: totalItems, completed: 0, failed: 0, processing: 0 });
  await yieldToUi();

  try {
    const result = await runJob({
      ...credentials,
      signal: controller.signal,
      onJobSubmitted: ({ jobId }) => {
        state.activeExportJobs[resultId] = {
          jobId,
          region: credentials.region,
          token: credentials.token,
        };
      },
      onProgress: renderProgress,
    });
    clearState();
    return result;
  } catch (error) {
    clearState();
    throw error;
  } finally {
    delete state.activeExports[resultId];
    delete state.activeExportJobs[resultId];
  }
};

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
  const failureDetail =
    failedCount > 0 || unknownCount > 0
      ? `, ${failedCount} failed${unknownCount > 0 ? `, ${unknownCount} unknown` : ""}`
      : "";

  return `${successCount}/${rows.length} succeeded${failureDetail}`;
};

const formatElapsedSuffix = (elapsedMs) => {
  const safeElapsedMs = Number(elapsedMs) || 0;
  if (safeElapsedMs <= 0) {
    return "";
  }

  return ` in ${Math.round(safeElapsedMs / 1000)}s`;
};

const buildBulkCompletionStatus = (rows, { job = null, elapsedMs = 0 } = {}) => {
  const baseStatus = summarizeBulkStatuses(rows);
  const metrics = job?.metrics;
  const durationMs =
    Number(metrics?.durationMs) > 0 ? Number(metrics.durationMs) : Number(elapsedMs) || 0;
  const elapsedSuffix = formatElapsedSuffix(durationMs);

  return elapsedSuffix ? `${baseStatus}${elapsedSuffix}` : baseStatus;
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

const captureFocusedField = (root) => {
  const active = document.activeElement;
  if (!active || !root.contains(active)) {
    return null;
  }

  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
    return null;
  }

  return {
    id: active.id || "",
    preserveClass:
      [...active.classList].find((cls) => cls.includes("user-filter") || cls.includes("entity-filter")) || "",
    selectionStart: active.selectionStart,
    selectionEnd: active.selectionEnd,
  };
};

const restoreFocusedField = (root, snapshot) => {
  if (!snapshot) {
    return;
  }

  let input = snapshot.id ? document.getElementById(snapshot.id) : null;
  if ((!input || !root.contains(input)) && snapshot.preserveClass) {
    input = root.querySelector(`input.${snapshot.preserveClass}`);
  }

  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
    return;
  }

  input.focus();

  if (typeof snapshot.selectionStart === "number" && typeof input.setSelectionRange === "function") {
    try {
      input.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd ?? snapshot.selectionStart);
    } catch {
      // Some input types do not support selection ranges.
    }
  }
};

export {
  buildBulkCompletionStatus,
  buildJobSnapshotProgress,
  captureBulkUserListScroll,
  captureFocusedField,
  createRoleAssignmentEntry,
  createSkillAssignmentEntry,
  executeBulkJobWithProgress,
  filterUsers,
  formatBulkProgressGuidance,
  formatElapsedSuffix,
  getSelectedUsers,
  mapNamedOptions,
  restoreBulkUserListScroll,
  restoreFocusedField,
  summarizeBulkStatuses,
  updateBulkUserSelectionUi,
};
