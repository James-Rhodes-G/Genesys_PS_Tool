import {
  getConnectedAt,
  getOrganizationId,
  getOrganizationName,
  getPreferredTargetOrg,
  getRegion,
  getToken,
  isConnected,
  setConnected,
  setOrganizationId,
  setOrganizationName,
  setPreferredTargetOrg,
  setRegion,
  setToken,
} from "./genesys-auth.js";
import {
  clearOAuthAutoConnect,
  clearOAuthError,
  clearOAuthIntendedOrganization,
  clearOAuthPendingOrgPicker,
  getOAuthConfig,
  getOAuthError,
  getOAuthIntendedOrganization,
  OAUTH_PHASE_CONNECT,
  OAUTH_PHASE_ORG_PICKER,
  shouldAutoConnectAfterOAuth,
  shouldShowOrgPickerAfterOAuth,
  startClientOrgLogin,
  startPkceLogin,
  startPrimaryOrgLogin,
} from "./genesys-oauth-pkce.js";
import {
  buildProgressiveExportStatusParts,
  findClickControl,
  renderExportProgressState,
  renderExportSummaryStatus,
} from "./export-progress.js";
import { collectUserRoleMappings } from "./user-role-export.js";
import { collectUserSkillMappings, formatUserSkillAssignments, getSkillsFromUser } from "./user-skill-export.js";
import {
  connect,
  assignRoutingSkillsToUsers,
  assignUsersToRoleDivision,
  buildPhones,
  createMasterAdminRole,
  disconnectConversations,
  getAccessibleOrganizations,
  getAuthorizationSubject,
  getBotFlows,
  getBotUtterances,
  createAuditQuery,
  createNotificationChannel,
  deleteNotificationChannel,
  deletePhones,
  exportDataTables,
  getAuditQueryResults,
  getAuditQueryStatus,
  getAuditServiceMapping,
  getAvailableNotificationTopics,
  getConversation,
  getCurrentUser,
  getDataTables,
  getGroupMembers,
  getGroups,
  getDivisions,
  getIntentHealth,
  getOrganizationLimits,
  getPasswordPolicy,
  getPhones,
  getPrompts,
  getQueueMembers,
  getQueues,
  getCampaigns,
  getRoles,
  getScheduleTemplates,
  getSites,
  getSkills,
  getTelephonyCallMetrics,
  getUser,
  loadGenesysRegions,
  loadSchedules,
  logoffUsers,
  movePhonesToSite,
  queryOpenQueueInteractions,
  resetUsersPasswords,
  setUsersAutoAnswer,
  spoofInboundCall,
  spoofOutboundCall,
  subscribeNotificationTopics,
  updateConversationPriorities,
} from "./genesys-client.js";
import { createBulkSkillAssignFeature } from "./bulk-skill-assign.js";
import { createBulkRoleAssignFeature } from "./bulk-role-assign.js";
import { createBulkAutoAnswerFeature } from "./bulk-auto-answer.js";
import { createBulkPasswordResetFeature } from "./bulk-password-reset-feature.js";
import { createBulkLogoffFeature } from "./bulk-logoff.js";
import { createBulkDisconnectFeature } from "./bulk-disconnect.js";
import { createBulkPhoneBuildFeature } from "./bulk-phone-build.js";
import { createBulkPhoneMoveFeature } from "./bulk-phone-move.js";
import { createBulkPhoneRemoveFeature } from "./bulk-phone-remove.js";
import { createBulkPhoneSiteMigrateFeature } from "./bulk-phone-site-migrate.js";
import { createBulkPriorityUpdateFeature } from "./bulk-priority-update.js";
import { createDataTableExportFeature } from "./datatable-export.js";
import {
  clearResourceCaches,
  getCachedDataTables,
  getCachedGroups,
  getCachedPhones,
  getCachedQueues,
  getCachedRoles,
  getCachedSites,
  getCachedSkills,
  peekCachedPhones,
} from "./resource-cache.js";
import { createDashboardFeature } from "./dashboard/dashboard-feature.js";
import { clearInventoryStore } from "./dashboard/inventory-store.js";
import {
  ACTIVITY_EXPORT_TYPES,
  clearSessionActivities,
  recordSessionActivityFromResults,
} from "./dashboard/session-activity.js";
import { createMasterAdminFeature } from "./create-master-admin.js";
import { createLoadSchedulesFeature } from "./load-schedules.js";
import { createInboundCallSpoofFeature } from "./inbound-call-spoof.js";
import { createOutboundCallSpoofFeature } from "./outbound-call-spoof.js";
import {
  formatDateTimeForAttribute,
  loadFieldHistory,
  parseCustomAttributesText,
  rememberFieldHistory,
  renderGuxDateTimeField,
  renderGuxPhoneField,
  renderGuxTextField,
  renderGuxTextareaField,
  renderGuxTimezoneDropdown,
  toDateTimeLocalValue,
} from "./call-spoof-form.js";
import {
  getRegionControlValue,
  populateRegionControl,
  readControlValue,
  renderGuxColumnMoveButton,
  renderGuxExportToolbar,
  renderGuxFieldCheckbox,
  renderGuxFieldSelect,
  renderGuxTable,
  resolveFieldClass,
} from "./gux-ui.js";
import { createIntentHealthFeature } from "./intent-health.js";
import { createUtterancesFeature } from "./utterances.js";
import { createAuditLogViewerFeature } from "./audit-log-viewer.js";
import { createMockApiFeature } from "./mock-api-feature.js";
import { createFlowExecutionFeature } from "./flow-execution-feature.js";
import { clearFlowExecutionModelCache } from "./flow-execution-client.js";
import { createUserNotificationsFeature } from "./user-notifications.js";
import { createQueueNotificationsFeature } from "./queue-notifications.js";
import { createOutboundNotificationsFeature } from "./outbound-notifications.js";
import { createNotificationMessageParserFeature } from "./notification-message-parser-feature.js";
import {
  SESSION_OFFLOAD_THRESHOLD,
  SESSION_ROW_PAGE_SIZE,
  bindSession,
  clearSession,
  fetchAllExportRows,
  fetchCachedUsers,
  fetchExportRows,
  fetchSessionStatus,
  fetchUserSyncStatus,
  loadSessionUsers,
  saveExportToSession,
  syncSessionUsers,
} from "./session-store.js";
import { formatPipeSeparatedDisplay, joinPipeSeparatedCsv } from "./export-format.js";
import { wireExportTableResize } from "./export-table-layout.js";
import { getSelectedBotFlow, mapBotFlowOptions, validatePublishedBotFlow } from "./bot-flow-utils.js";
import { createPasswordResetWorkflow } from "./bulk-password-reset.js";
import {
  mapNamedOptions,
  summarizeBulkStatuses,
} from "./bulk-utils.js";
import {
  createRandomPassword,
  describePasswordPolicy,
  normalizePasswordPolicy,
  validatePasswordAgainstPolicy,
} from "./password-policy.js";
import { createConfirmModal } from "./confirm-modal.js";
import { createOrgPickerModal } from "./org-picker-modal.js";
import { renderLoadingState } from "./loading-message.js";
import {
  captureBulkUserListScroll,
  captureFocusedField,
  restoreBulkUserListScroll,
  restoreFocusedField,
} from "./bulk-utils.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const humanizeColumnKey = (key) =>
  key
    .replace(/\[\]/g, " ")
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatUserRoleNames = (user) => {
  const roles = user?.authorization?.roles;
  if (!Array.isArray(roles) || roles.length === 0) {
    return "";
  }

  return roles
    .map((role) => role?.name || role?.id || "")
    .filter(Boolean)
    .join(" | ");
};

const USER_EXPORT_DYNAMIC_EXCLUDED = new Set([
  "name",
  "id",
  "userName",
  "username",
  "authorization.roles[].id",
  "authorization.roles[].name",
  "authorization.unusedRoles[].id",
  "authorization.unusedRoles[].name",
  "skills[].id",
  "skills[].name",
  "skills[].proficiency",
]);

const collectLeafPaths = (value, prefix, paths) => {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectLeafPaths(item, prefix ? `${prefix}[]` : "[]", paths);
    });
    return;
  }

  if (value && typeof value === "object") {
    Object.keys(value).forEach((key) => {
      collectLeafPaths(value[key], prefix ? `${prefix}.${key}` : key, paths);
    });
    return;
  }

  if (prefix) {
    paths.add(prefix);
  }
};

const getValuesForPath = (source, path) => {
  const segments = String(path || "").split(".");

  const visit = (current, index) => {
    if (index >= segments.length) {
      return [current];
    }

    const segment = segments[index];
    const isArraySegment = segment.endsWith("[]");
    const key = isArraySegment ? segment.slice(0, -2) : segment;
    const next = key ? current && current[key] : current;

    if (isArraySegment) {
      if (!Array.isArray(next)) {
        return [];
      }

      return next.flatMap((item) => visit(item, index + 1));
    }

    return visit(next, index + 1);
  };

  return visit(source, 0).filter((value) => value != null && value !== "");
};

const formatCellValue = (value) => {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

const flattenObjectEntries = (value, prefix = "") => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [{ key: prefix, value: value == null ? "" : formatCellValue(value) }] : [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      return flattenObjectEntries(child, nextKey);
    }

    if (Array.isArray(child)) {
      return [{ key: nextKey, value: child.map(formatCellValue).join(" | ") }];
    }

    return [{ key: nextKey, value: child == null ? "" : formatCellValue(child) }];
  });
};

const createDynamicColumns = (rows, excludedKeys) => {
  const paths = new Set();

  rows.forEach((row) => {
    collectLeafPaths(row, "", paths);
  });

  return Array.from(paths)
    .filter((key) => !excludedKeys.has(key))
    .sort()
    .map((key) => ({
      key,
      header: humanizeColumnKey(key),
    }));
};

const buildExportFilename = (exportType) => {
  const organizationName = (getOrganizationName() || "organization")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  const date = new Date();
  const stamp =
    String(date.getFullYear()) +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");

  return `${organizationName}_${exportType}_${stamp}.csv`;
};

const renderJsonBlock = (value) =>
  `<div class="log-output__json"><pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre></div>`;

const renderExportSectionWithActions = (title, status, contentHtml) =>
  `<details class="log-output export-results" open><summary class="export-results__summary"><span class="export-results__title">${escapeHtml(title)}</span><span class="export-results__status muted">${escapeHtml(status)}</span></summary><div class="export-results__body">${contentHtml}</div></details>`;

  const createApp = () => {
  const state = {
    regions: [],
    exportData: {},
    activeExports: {},
    exportRefreshConfigs: {},
    exportRefreshInFlight: new Set(),
    hasConnection: false,
  };

    const getCurrentAppDomain = () => {
    const currentRegion = getRegion();
    const matchedRegion = state.regions.find(
      (region) => region.id === currentRegion || region.domain === currentRegion
    );

    return matchedRegion ? matchedRegion.domain : currentRegion;
  };

  const buildUserProfileLink = (userId) => {
    const safeUserId = escapeHtml(userId);
    const safeAppDomain = escapeHtml(getCurrentAppDomain());
    return `<a href="https://apps.${safeAppDomain}/directory/#/admin/directory/peopleV2/${safeUserId}" target="_blank" rel="noreferrer noopener">${safeUserId}</a>`;
  };

  const hasPhoneRecordingEnabled = (phone) =>
    Array.isArray(phone.lines) &&
    phone.lines.some(
      (line) =>
        line &&
        line.properties &&
        line.properties.station_recording_enabled &&
        line.properties.station_recording_enabled.value &&
        line.properties.station_recording_enabled.value.instance != null &&
        line.properties.station_recording_enabled.value.instance !== ""
    );

  const getColumnValues = (column, row) => {
    if (typeof column.getValues === "function") {
      return column.getValues(row);
    }

    return getValuesForPath(row, column.key);
  };

  const renderColumnCell = (column, row) => {
    if (typeof column.renderCell === "function") {
      return column.renderCell(row);
    }

    const values = getColumnValues(column, row)
      .map(formatCellValue)
      .filter((value) => value !== "");

    if (values.length === 0) {
      return "";
    }

    return formatPipeSeparatedDisplay(joinPipeSeparatedCsv(values));
  };

  const getColumnCsvValue = (column, row) => {
    if (typeof column.toCsv === "function") {
      return column.toCsv(row);
    }

    const values = getColumnValues(column, row)
      .map(formatCellValue)
      .filter((value) => value !== "");

    return joinPipeSeparatedCsv(values);
  };

  const createUsersExportMeta = (resultId, rows, title, status) => {
    const baseColumns = [
      { key: "name", header: "Name" },
      {
        key: "id",
        header: "ID",
        renderCell: (row) => buildUserProfileLink(row.id),
      },
      {
        key: "userName",
        header: "User Name",
        getValues: (row) => [row.userName || row.username].filter(Boolean),
        toCsv: (row) => row.userName || row.username || "",
      },
      {
        key: "roles",
        header: "Roles",
        getValues: (row) => [formatUserRoleNames(row)].filter(Boolean),
        toCsv: (row) => formatUserRoleNames(row),
      },
      {
        key: "skills",
        header: "Skills",
        getValues: (row) => [formatUserSkillAssignments(getSkillsFromUser(row))].filter(Boolean),
        toCsv: (row) => formatUserSkillAssignments(getSkillsFromUser(row)),
      },
    ];
    const dynamicColumns = createDynamicColumns(rows, USER_EXPORT_DYNAMIC_EXCLUDED);

    return {
      resultId,
      title,
      status,
      exportType: "users",
      rows,
      editMode: false,
      availableColumns: baseColumns.concat(dynamicColumns),
      selectedColumnKeys: ["name", "id", "userName", "department", "state", "division.name"],
    };
  };

  const createUserRoleMappingsExportMeta = (resultId, rows, title, status) => ({
    resultId,
    title,
    status,
    exportType: "user_role_mappings",
    rows,
    editMode: false,
    availableColumns: [
      { key: "name", header: "Name" },
      {
        key: "userName",
        header: "User Name",
        getValues: (row) => [row.userName || row.username].filter(Boolean),
        toCsv: (row) => row.userName || row.username || "",
      },
      {
        key: "userId",
        header: "User ID",
        renderCell: (row) => buildUserProfileLink(row.userId),
        toCsv: (row) => row.userId || "",
      },
      {
        key: "roleAssignments",
        header: "Role:Division",
        toCsv: (row) => row.roleAssignments || "",
      },
      { key: "status", header: "Status" },
      { key: "error", header: "Error" },
    ],
    selectedColumnKeys: ["name", "userName", "userId", "roleAssignments", "status", "error"],
  });

  const createUserSkillMappingsExportMeta = (resultId, rows, title, status) => ({
    resultId,
    title,
    status,
    exportType: "user_skill_mappings",
    rows,
    editMode: false,
    availableColumns: [
      { key: "name", header: "Name" },
      {
        key: "userName",
        header: "User Name",
        getValues: (row) => [row.userName || row.username].filter(Boolean),
        toCsv: (row) => row.userName || row.username || "",
      },
      {
        key: "userId",
        header: "User ID",
        renderCell: (row) => buildUserProfileLink(row.userId),
        toCsv: (row) => row.userId || "",
      },
      {
        key: "skillAssignments",
        header: "Skill:Proficiency",
        toCsv: (row) => row.skillAssignments || "",
      },
      { key: "status", header: "Status" },
      { key: "error", header: "Error" },
    ],
    selectedColumnKeys: ["name", "userName", "userId", "skillAssignments", "status", "error"],
  });

  const buildRoleProfileLink = (roleId, label) => {
    const safeRoleId = escapeHtml(roleId);
    const safeAppDomain = escapeHtml(getCurrentAppDomain());
    const safeLabel = escapeHtml(label || roleId);
    if (!roleId || !getCurrentAppDomain()) {
      return safeLabel;
    }
    return `<a href="https://apps.${safeAppDomain}/directory/#/admin/people-permissions/roles/${safeRoleId}" target="_blank" rel="noreferrer noopener">${safeLabel}</a>`;
  };

  const normalizeScheduleRouteId = (scheduleId) => String(scheduleId || "").replace(".", "").slice(-36);

  const buildScheduleProfileLink = (scheduleId, label) => {
    const normalizedScheduleId = normalizeScheduleRouteId(scheduleId);
    const safeScheduleId = escapeHtml(normalizedScheduleId);
    const safeAppDomain = escapeHtml(getCurrentAppDomain());
    const safeLabel = escapeHtml(label || scheduleId);
    if (!normalizedScheduleId || !getCurrentAppDomain()) {
      return safeLabel;
    }
    return `<a href="https://apps.${safeAppDomain}/directory/#/admin/routing/scheduling/schedules/${safeScheduleId}" target="_blank" rel="noreferrer noopener">${safeLabel}</a>`;
  };

  const createMasterAdminResultsMeta = (resultId, rows, title, status) => ({
    resultId,
    title,
    status,
    exportType: "master_admin_role",
    rows,
    editMode: false,
    availableColumns: [
      {
        key: "roleName",
        header: "Role Name",
        renderCell: (row) => buildRoleProfileLink(row.roleId, row.roleName),
        toCsv: (row) => row.roleName || "",
      },
      {
        key: "roleId",
        header: "Role ID",
        renderCell: (row) => buildRoleProfileLink(row.roleId, row.roleId),
        toCsv: (row) => row.roleId || "",
      },
      { key: "description", header: "Description" },
      { key: "generalPermissionCount", header: "General Permissions" },
      { key: "permissionPolicyCount", header: "Permission Policies" },
      { key: "status", header: "Status" },
      { key: "error", header: "Error" },
    ],
    selectedColumnKeys: [
      "roleName",
      "roleId",
      "description",
      "generalPermissionCount",
      "permissionPolicyCount",
      "status",
      "error",
    ],
  });

  const createLoadSchedulesResultsMeta = (resultId, rows, title, status) => ({
    resultId,
    title,
    status,
    exportType: "load_schedules",
    rows,
    editMode: false,
    availableColumns: [
      {
        key: "requestedName",
        header: "Schedule Name",
        renderCell: (row) =>
          buildScheduleProfileLink(row.scheduleId, row.scheduleName || row.requestedName),
        toCsv: (row) => row.scheduleName || row.requestedName || "",
      },
      { key: "countryCode", header: "Country" },
      { key: "sourceName", header: "Template Name" },
      {
        key: "scheduleId",
        header: "Schedule ID",
        renderCell: (row) => buildScheduleProfileLink(row.scheduleId, row.scheduleId),
        toCsv: (row) => row.scheduleId || "",
      },
      { key: "status", header: "Status" },
      { key: "error", header: "Error" },
    ],
    selectedColumnKeys: ["requestedName", "countryCode", "sourceName", "scheduleId", "status", "error"],
  });

  const createConversationAttributesExportMeta = (resultId, conversationId, conversation) => {
    const conversationAttributes = flattenObjectEntries(conversation?.attributes || {}).map((entry) => ({
      scope: "Conversation",
      participantName: "",
      participantPurpose: "",
      key: entry.key,
      value: entry.value,
    }));

    const participantAttributes = Array.isArray(conversation?.participants)
      ? conversation.participants.flatMap((participant) =>
          flattenObjectEntries(participant?.attributes || {}).map((entry) => ({
            scope: "Participant",
            participantName:
              participant?.name || participant?.userId || participant?.externalContactId || participant?.id || "",
            participantPurpose: participant?.purpose || "",
            key: entry.key,
            value: entry.value,
          }))
        )
      : [];

    const rows = conversationAttributes.concat(participantAttributes);

    return {
      resultId,
      title: "Report: Attributes",
      status: `Loaded ${rows.length} attributes`,
      exportType: "attributes",
      rows,
      editMode: false,
      availableColumns: [
        { key: "scope", header: "Scope" },
        { key: "participantName", header: "Participant" },
        { key: "participantPurpose", header: "Purpose" },
        { key: "key", header: "Attribute" },
        { key: "value", header: "Value" },
      ],
      selectedColumnKeys: ["scope", "participantName", "participantPurpose", "key", "value"],
      emptyHtml: `<p class="muted">No conversation or participant attributes found for ${escapeHtml(conversationId)}.</p>`,
    };
  };

  const createOutboundCallSpoofResultsMeta = (resultId, rows, title, status) => ({
    resultId,
    title,
    status,
    exportType: "call_spoof",
    rows,
    editMode: false,
    availableColumns: [
      { key: "phoneNumber", header: "Number to Dial" },
      { key: "callerId", header: "Outbound CLID" },
      { key: "callerIdName", header: "Outbound CNAM" },
      {
        key: "conversationId",
        header: "Conversation ID",
        renderCell: (row) => {
          const conversationId = row?.conversationId || "";
          const appDomain = getCurrentAppDomain();

          if (!conversationId || !appDomain) {
            return escapeHtml(conversationId);
          }

          return `<a href="https://apps.${escapeHtml(appDomain)}/directory/#/analytics/interactions/${escapeHtml(
            conversationId
          )}/admin" target="_blank" rel="noreferrer noopener">${escapeHtml(conversationId)}</a>`;
        },
        toCsv: (row) => row?.conversationId || "",
      },
      { key: "status", header: "Status" },
      { key: "error", header: "Error" },
    ],
    selectedColumnKeys: ["phoneNumber", "callerId", "callerIdName", "conversationId", "status", "error"],
  });

  const createInboundCallSpoofResultsMeta = (resultId, rows, title, status) => ({
    resultId,
    title,
    status,
    exportType: "call_spoof",
    rows,
    editMode: false,
    availableColumns: [
      { key: "callUserLabel", header: "User" },
      { key: "inboundDnis", header: "Inbound DNIS" },
      { key: "callerId", header: "Caller ID / ANI" },
      { key: "callerIdName", header: "Caller ID Name" },
      { key: "callDateTime", header: "Date and Time" },
      { key: "callTimeZone", header: "Time Zone" },
      { key: "uuiData", header: "UUI Data" },
      { key: "description", header: "Description" },
      {
        key: "conversationId",
        header: "Conversation ID",
        renderCell: (row) => {
          const conversationId = row?.conversationId || "";
          const appDomain = getCurrentAppDomain();

          if (!conversationId || !appDomain) {
            return escapeHtml(conversationId);
          }

          return `<a href="https://apps.${escapeHtml(appDomain)}/directory/#/analytics/interactions/${escapeHtml(
            conversationId
          )}/admin" target="_blank" rel="noreferrer noopener">${escapeHtml(conversationId)}</a>`;
        },
        toCsv: (row) => row?.conversationId || "",
      },
      { key: "status", header: "Status" },
      { key: "error", header: "Error" },
    ],
    selectedColumnKeys: [
      "callUserLabel",
      "inboundDnis",
      "callerId",
      "callerIdName",
      "callDateTime",
      "callTimeZone",
      "uuiData",
      "description",
      "conversationId",
      "status",
      "error",
    ],
  });

  const createIntentHealthResultsMeta = (resultId, rows, title, status) => ({
    resultId,
    title,
    status,
    exportType: "intent_health",
    rows,
    editMode: false,
    availableColumns: [
      { key: "intentId", header: "Intent ID" },
      { key: "name", header: "Name" },
      { key: "languageHealth", header: "Language Health" },
    ],
    selectedColumnKeys: ["intentId", "name", "languageHealth"],
  });

  const createUtterancesResultsMeta = (resultId, rows, title, status, appDomain, flowId, flowName) => ({
    resultId,
    title,
    status,
    exportType: "utterances",
    rows,
    editMode: false,
    availableColumns: [
      {
        key: "conversationId",
        header: "Conversation ID",
        renderCell: (row) => {
          const conversationId = row?.conversationId || "";
          if (!conversationId || !appDomain) {
            return escapeHtml(conversationId);
          }
          return `<a href="https://apps.${escapeHtml(appDomain)}/directory/#/analytics/interactions/${escapeHtml(
            conversationId
          )}/admin" target="_blank" rel="noreferrer noopener">${escapeHtml(conversationId)}</a>`;
        },
        toCsv: (row) => row?.conversationId || "",
      },
      {
        key: "sessionId",
        header: "Session ID",
        renderCell: (row) => {
          const sessionId = row?.sessionId || "";
          if (!sessionId) {
            return "";
          }
          return `<button type="button" class="utterance-filter-link" data-result-id="${escapeHtml(
            resultId
          )}" data-filter-key="sessionId" data-filter-value="${escapeHtml(sessionId)}">${escapeHtml(sessionId)}</button>`;
        },
        toCsv: (row) => row?.sessionId || "",
      },
      { key: "dateCompleted", header: "Date Completed" },
      { key: "userInput", header: "User Input" },
      { key: "botPrompts", header: "Bot Prompt" },
      {
        key: "actionNumber",
        header: "Action Number",
        renderCell: (row) => {
          const actionNumber = row?.actionNumber || "";
          const actionId = row?.actionId || "";
          if (!actionId) {
            return escapeHtml(actionNumber);
          }
          return `<button type="button" class="utterance-filter-link" data-result-id="${escapeHtml(
            resultId
          )}" data-filter-key="askActionId" data-filter-value="${escapeHtml(actionId)}">${escapeHtml(actionNumber)}</button>`;
        },
        toCsv: (row) => row?.actionNumber || "",
      },
      { key: "actionType", header: "Action Type" },
      {
        key: "askActionResult",
        header: "Action Result",
        renderCell: (row) => {
          const askActionResult = row?.askActionResult || "";
          if (!askActionResult) {
            return "";
          }
          return `<button type="button" class="utterance-filter-link" data-result-id="${escapeHtml(
            resultId
          )}" data-filter-key="askActionResults" data-filter-value="${escapeHtml(askActionResult)}">${escapeHtml(
            askActionResult
          )}</button>`;
        },
        toCsv: (row) => row?.askActionResult || "",
      },
    ],
    selectedColumnKeys: [
      "conversationId",
      "sessionId",
      "dateCompleted",
      "userInput",
      "botPrompts",
      "actionNumber",
      "actionType",
      "askActionResult",
    ],
    flowId,
    flowName,
  });

  const createPhonesExportMeta = (resultId, rows, title, status) => {
    const baseColumns = [
      { key: "name", header: "Name" },
      { key: "site.name", header: "Site" },
      { key: "phoneBaseSettings.name", header: "Base Settings" },
      {
        key: "__stationRecording",
        header: "Station Recording",
        getValues: (row) => [hasPhoneRecordingEnabled(row) ? "true" : "false"],
        renderCell: (row) => (hasPhoneRecordingEnabled(row) ? "✅" : "❌"),
        toCsv: (row) => (hasPhoneRecordingEnabled(row) ? "true" : "false"),
      },
    ];
    const dynamicColumns = createDynamicColumns(
      rows,
      new Set(["name", "site.name", "phoneBaseSettings.name"])
    );

    return {
      resultId,
      title,
      status,
      exportType: "phones",
      rows,
      editMode: false,
      availableColumns: baseColumns.concat(dynamicColumns),
      selectedColumnKeys: ["name", "site.name", "phoneBaseSettings.name", "__stationRecording"],
    };
  };

    const createSimpleExportMeta = (resultId, rows, title, status, exportType, preferredColumns = []) => {
      const dynamicColumns = createDynamicColumns(rows, new Set());
      const selectedColumnKeys = preferredColumns.filter((column) =>
        dynamicColumns.some((candidate) => candidate.key === column)
    );

    return {
      resultId,
      title,
      status,
      exportType,
        rows,
        editMode: false,
        availableColumns: dynamicColumns,
        selectedColumnKeys: selectedColumnKeys.length > 0 ? selectedColumnKeys : dynamicColumns.slice(0, 6).map((column) => column.key),
      };
    };

    const createPromptsExportMeta = (resultId, rows, title, status) =>
      createSimpleExportMeta(
        resultId,
        rows,
        title,
        status,
        "prompts",
        ["name", "description", "resources[].id", "resources[].uploadStatus", "resources[].ttsString", "resources[].mediaUri"]
      );

    const createQueueMembersExportMeta = (resultId, rows, title, status) => {
      const baseColumns = [
        { key: "name", header: "Name" },
        { key: "user.id", header: "User ID" },
        { key: "user.division.name", header: "Division" },
        { key: "user.department", header: "Department" },
        { key: "user.state", header: "State" },
        { key: "user.acdAutoAnswer", header: "ACD Auto Answer" },
        { key: "ringNumber", header: "Ring Number" },
        { key: "memberBy", header: "Member By" },
      ];
      const dynamicColumns = createDynamicColumns(
        rows,
        new Set([
          "name",
          "user.id",
          "user.division.name",
          "user.department",
          "user.state",
          "user.acdAutoAnswer",
          "ringNumber",
          "memberBy",
        ])
      );

      return {
        resultId,
        title,
        status,
        exportType: "queue_members",
        rows,
        editMode: false,
        availableColumns: baseColumns.concat(dynamicColumns),
        selectedColumnKeys: baseColumns.map((column) => column.key),
      };
    };

    const createGroupMembersExportMeta = (resultId, rows, title, status) =>
      createSimpleExportMeta(resultId, rows, title, status, "group_members", ["id", "selfUri"]);

    const persistExportToSession = async (resultId, exportMeta) => {
      if (!exportMeta || !Array.isArray(exportMeta.rows) || !getOrganizationId() || !isConnected()) {
        return;
      }

      // User rows are already stored in the session user cache; avoid duplicating large payloads.
      if (exportMeta.exportType === "users") {
        return;
      }

      try {
        await saveExportToSession({
          exportId: resultId,
          exportMeta: { ...exportMeta, resultId },
          rows: exportMeta.rows,
        });

        if (exportMeta.rows.length >= SESSION_OFFLOAD_THRESHOLD) {
          exportMeta.sessionStored = true;
          exportMeta.sessionRowCount = exportMeta.rows.length;
          exportMeta.sessionRowsLoaded = Math.min(SESSION_ROW_PAGE_SIZE, exportMeta.rows.length);
          exportMeta.rows = exportMeta.rows.slice(0, exportMeta.sessionRowsLoaded);
        }
      } catch (error) {
        console.warn("Failed to persist export to session store:", error);
      }
    };

    const renderSessionRowsFooter = (exportId, exportMeta) => {
      if (!exportMeta.sessionStored) {
        return "";
      }

      const loadedCount = exportMeta.rows?.length || 0;
      const totalCount = exportMeta.sessionRowCount || loadedCount;
      const canLoadMore = loadedCount < totalCount;

      return `<div class="export-session-footer">
        <span class="muted">Showing ${loadedCount} of ${totalCount} rows stored for this organization connection.</span>
        ${
          canLoadMore
            ? `<gux-button class="export-session-load-more" type="button" accent="secondary" data-export-id="${escapeHtml(
                exportId
              )}">Load more rows</gux-button>`
            : ""
        }
      </div>`;
    };

    const renderEditableTableContent = (exportId) => {
      const exportMeta = state.exportData[exportId];
      if (!exportMeta) {
        return '<p class="muted">No export data available.</p>';
      }

      const leadingColumns = (exportMeta.leadingColumns || []).filter(Boolean);
      const dataColumns = exportMeta.selectedColumnKeys
        .map((key) => exportMeta.availableColumns.find((column) => column.key === key))
        .filter(Boolean);
      const selectedColumns = [...leadingColumns, ...dataColumns];

      const editorHtml = exportMeta.editMode
        ? `<div class="column-editor"><div class="column-editor__header">Edit columns</div><div class="column-editor__grid">${exportMeta.availableColumns
            .map((column) => {
              const checked = exportMeta.selectedColumnKeys.includes(column.key);
              const selectedIndex = exportMeta.selectedColumnKeys.indexOf(column.key);
              const canMoveUp = selectedIndex > 0;
              const canMoveDown =
                selectedIndex !== -1 && selectedIndex < exportMeta.selectedColumnKeys.length - 1;

              return `<div class="column-editor__option">${renderGuxFieldCheckbox({
                escapeHtml,
                className: "column-toggle",
                label: column.header,
                checked,
                attrs: `data-export-id="${escapeHtml(exportId)}" data-column-key="${escapeHtml(column.key)}"`,
                labelPosition: "beside",
              })}<span class="column-editor__order">${renderGuxColumnMoveButton({
                escapeHtml,
                exportId,
                columnKey: column.key,
                direction: "up",
                disabled: !canMoveUp,
              })}${renderGuxColumnMoveButton({
                escapeHtml,
                exportId,
                columnKey: column.key,
                direction: "down",
                disabled: !canMoveDown,
              })}</span></div>`;
            })
            .join("")}</div></div>`
        : "";

    const exportToolbarHtml = renderGuxExportToolbar({
      escapeHtml,
      exportId,
      showEdit: exportMeta.editable !== false,
    });

    if (selectedColumns.length === 0) {
      return `${editorHtml}<div class="gux-table-shell">${exportToolbarHtml}<p class="muted">Select at least one column.</p></div>`;
    }

    return `${editorHtml}${renderGuxTable({
      columns: selectedColumns,
      rows: exportMeta.rows,
      renderCell: (column, row) => {
        if (typeof column.renderCell === "function") {
          return column.renderCell(row, exportMeta);
        }

        return renderColumnCell(column, row);
      },
      escapeHtml,
      toolbarHtml: exportToolbarHtml,
      shell: true,
      resizable: true,
      wrapCells: true,
      columnWidths: exportMeta.columnWidths || {},
      emptyMessage: "No rows to display.",
    })}${renderSessionRowsFooter(exportId, exportMeta)}`;
  };

  const afterExportTableRender = (exportId) => {
    wireExportTableResize(exportId, {
      getExportMeta: () => state.exportData[exportId],
    });
  };

  const renderExportBody = (resultId, html, exportMeta) => {
    if (!exportMeta) {
      return html;
    }

    if (typeof exportMeta.renderBody === "function") {
      return exportMeta.renderBody(resultId, exportMeta);
    }

    return renderEditableTableContent(resultId);
  };

  const finishExportMarkup = (resultId, title, status, html, exportMeta) =>
    `<details id="${resultId}" class="log-output export-results" open><summary class="export-results__summary"><span class="export-results__title">${escapeHtml(title)}</span><span class="export-results__status muted">${
      exportMeta ? renderExportSummaryStatus(resultId, exportMeta) : escapeHtml(status)
    }</span></summary><div class="export-results__body">${exportMeta ? renderExportBody(resultId, html, exportMeta) : html}</div></details>`;

    const downloadCsv = async (exportId) => {
    const exportMeta = state.exportData[exportId];
    if (!exportMeta) {
      return;
    }

    const escapeCsv = (value) => {
      const stringValue = String(value == null ? "" : value);
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

      const selectedColumns = exportMeta.selectedColumnKeys
        .map((key) => exportMeta.availableColumns.find((column) => column.key === key))
        .filter(Boolean);

    let rows = exportMeta.rows || [];
    if (exportMeta.sessionStored) {
      try {
        const payload = await fetchAllExportRows({ exportId });
        rows = payload.rows || rows;
      } catch (error) {
        console.warn("Failed to load all session rows for CSV export:", error);
      }
    }

    const lines = [selectedColumns.map((column) => escapeCsv(column.header)).join(",")];

    rows.forEach((row) => {
      lines.push(selectedColumns.map((column) => escapeCsv(getColumnCsvValue(column, row))).join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildExportFilename(exportMeta.exportType || "export");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

    const initializeGenesysApp = () => {
    const tokenInput = document.getElementById("genesys-token");
    const connectBtn = document.getElementById("genesys-connect");
    const oauthLoginBtn = document.getElementById("genesys-oauth-login");
    const usersBtn = document.getElementById("genesys-users");
    const dashboardBtn = document.getElementById("genesys-dashboard");
    const userRolesBtn = document.getElementById("genesys-user-roles");
    const userSkillsBtn = document.getElementById("genesys-user-skills");
    const phonesBtn = document.getElementById("genesys-phones");
    const rolesBtn = document.getElementById("genesys-roles");
    const queuesBtn = document.getElementById("genesys-queues");
    const queueMembersBtn = document.getElementById("genesys-queue-members");
    const skillsBtn = document.getElementById("genesys-skills");
    const groupsBtn = document.getElementById("genesys-groups");
    const groupMembersBtn = document.getElementById("genesys-group-members");
    const promptsBtn = document.getElementById("genesys-prompts");
    const datatableExportBtn = document.getElementById("genesys-datatable-export");

    // Bulk Actions Buttons
    const bulkSkillsBtn = document.getElementById("genesys-bulk-skill-assignment");
    const bulkRoleAssignBtn = document.getElementById("genesys-bulk-role-assign");
    const bulkAutoAnswerBtn = document.getElementById("genesys-bulk-auto-answer");
    const bulkPasswordResetBtn = document.getElementById("genesys-bulk-password-reset");
    const bulkLogoffBtn = document.getElementById("genesys-bulk-logoff");
    const bulkDisconnectBtn = document.getElementById("genesys-bulk-disconnect");
    const bulkPriorityUpdateBtn = document.getElementById("genesys-bulk-priority-update");
    const bulkPhoneBuildBtn = document.getElementById("genesys-bulk-phone-build");
    const bulkPhoneMoveBtn = document.getElementById("genesys-bulk-phone-move");
    const bulkPhoneRemoveBtn = document.getElementById("genesys-bulk-phone-remove");
    const bulkPhoneSiteMigrateBtn = document.getElementById("genesys-bulk-phone-site-migrate");
    const loadSchedulesBtn = document.getElementById("genesys-load-schedules");
    const createMasterAdminBtn = document.getElementById("genesys-create-master-admin");
    const reportConversationIdInput = document.getElementById("genesys-report-conversation-id");
    const reportConversationBtn = document.getElementById("genesys-report-conversation");
    const reportAttributesBtn = document.getElementById("genesys-report-attributes");
    const reportFlowBtn = document.getElementById("genesys-report-flow");
    const reportInteractionBtn = document.getElementById("genesys-report-interaction");
    const reportCallSpoofBtn = document.getElementById("genesys-report-call-spoof");
    const inboundCallSpoofBtn = document.getElementById("genesys-inbound-call-spoof");
    const reportIntentHealthBtn = document.getElementById("genesys-report-intent-health");
    const reportUtterancesBtn = document.getElementById("genesys-report-utterances");
    const userNotificationsBtn = document.getElementById("genesys-user-notifications");
    const queueNotificationsBtn = document.getElementById("genesys-queue-notifications");
    const outboundNotificationsBtn = document.getElementById("genesys-outbound-notifications");
    const notificationMessageParserBtn = document.getElementById("genesys-notification-message-parser");
    const auditLogViewerBtn = document.getElementById("genesys-audit-log-viewer");
    const mockApiBtn = document.getElementById("genesys-mock-api");
    const confirmModalEl = document.getElementById("genesys-confirm-modal");
    const confirmModalTitleEl = document.getElementById("genesys-confirm-modal-title");
    const confirmModalBodyEl = document.getElementById("genesys-confirm-modal-body");
    const confirmModalCancelBtn = document.getElementById("genesys-confirm-modal-cancel");
    const confirmModalConfirmBtn = document.getElementById("genesys-confirm-modal-confirm");
    const orgPickerModalEl = document.getElementById("genesys-org-picker-modal");
    const orgPickerSearchEl = document.getElementById("genesys-org-picker-search");
    const orgPickerListEl = document.getElementById("genesys-org-picker-list");
    const orgPickerStatusEl = document.getElementById("genesys-org-picker-status");
    const orgPickerCancelBtn = document.getElementById("genesys-org-picker-cancel");
    const orgPickerSignInBtn = document.getElementById("genesys-org-picker-sign-in");

    const statusEl = document.getElementById("genesys-status");
    const orgBannerEl = document.getElementById("genesys-org-banner");
    const orgBannerTextEl = document.getElementById("genesys-org-banner-text");
    const orgBannerDisconnectBtn = document.getElementById("genesys-org-banner-disconnect");
    const exportsStatusEl = document.getElementById("exports-status");
    const reportsStatusEl = document.getElementById("reports-status");
    const inboundCallSpoofStatusEl = document.getElementById("inbound-call-spoof-status");
    const auditLogStatusEl = document.getElementById("audit-log-status");
    const mockApiStatusEl = document.getElementById("mock-api-status");
    const regionSelect = document.getElementById("genesys-region-select");
    const resultsListEl = document.getElementById("genesys-results-list");

    let dashboardFeatureRef = null;

    const showStatus = (message) => {
      if (statusEl) {
        statusEl.textContent = message;
      }
    };

      const setExportsEnabled = (enabled) => {
        state.hasConnection = enabled;
        [
          dashboardBtn,
          usersBtn,
          userRolesBtn,
          userSkillsBtn,
          phonesBtn,
          rolesBtn,
          queuesBtn,
          queueMembersBtn,
          skillsBtn,
          groupsBtn,
          groupMembersBtn,
          promptsBtn,
          datatableExportBtn,
          bulkSkillsBtn,
          bulkRoleAssignBtn,
          bulkAutoAnswerBtn,
          bulkPasswordResetBtn,
          bulkLogoffBtn,
          bulkDisconnectBtn,
          bulkPriorityUpdateBtn,
          bulkPhoneBuildBtn,
          bulkPhoneMoveBtn,
          bulkPhoneRemoveBtn,
          bulkPhoneSiteMigrateBtn,
          loadSchedulesBtn,
          createMasterAdminBtn,
          reportConversationBtn,
          reportAttributesBtn,
          reportFlowBtn,
          reportInteractionBtn,
          reportCallSpoofBtn,
          reportIntentHealthBtn,
          reportUtterancesBtn,
          userNotificationsBtn,
          queueNotificationsBtn,
          outboundNotificationsBtn,
          auditLogViewerBtn,
          mockApiBtn,
          inboundCallSpoofBtn,
        ].forEach((button) => {
          if (button) {
            button.disabled = !enabled;
          }
        });

        if (notificationMessageParserBtn) {
          notificationMessageParserBtn.disabled = false;
        }

      if (exportsStatusEl) {
        exportsStatusEl.textContent = enabled
          ? "Exports enabled for the connected organization."
          : "Connect to an organization to enable exports.";
      }

      const dashboardStatusEl = document.getElementById("dashboard-status");
      if (dashboardStatusEl) {
        dashboardStatusEl.textContent = enabled
          ? "Dashboard available for the connected organization."
          : "Connect to an organization to view the dashboard.";
      }

      if (reportsStatusEl) {
        reportsStatusEl.textContent = enabled
          ? "Reports enabled for the connected organization."
          : "Connect to an organization to run reports.";
      }

      if (inboundCallSpoofStatusEl) {
        inboundCallSpoofStatusEl.textContent = enabled
          ? "Inbound call spoof enabled for the connected organization."
          : "Connect to an organization to run inbound call spoof tests.";
      }

      const bulkActionsStatusEl = document.getElementById("bulk-actions-status");
      if (bulkActionsStatusEl) {
        bulkActionsStatusEl.textContent = enabled
          ? "Bulk actions enabled for the connected organization."
          : "Connect to an organization to run bulk changes.";
      }

      if (auditLogStatusEl) {
        auditLogStatusEl.textContent = enabled
          ? "Audit log queries enabled for the connected organization."
          : "Connect to an organization to query audit logs.";
      }

      if (mockApiStatusEl) {
        mockApiStatusEl.textContent = enabled
          ? "Mock API management enabled for the connected organization."
          : "Connect to an organization to manage mock endpoints.";
      }

      const quickActionsStatusEl = document.getElementById("quick-actions-status");
      if (quickActionsStatusEl) {
        quickActionsStatusEl.textContent = enabled
          ? "Quick actions enabled for the connected organization."
          : "Connect to an organization to run quick changes.";
      }
    };

    const syncOrgBanner = () => {
      if (!orgBannerEl) {
        return;
      }

      const connected = isConnected();
      const orgName = getOrganizationName().trim();
      if (connected && orgName) {
        orgBannerEl.hidden = false;
        if (orgBannerTextEl) {
          orgBannerTextEl.textContent = `You are viewing ${orgName}`;
        }
        return;
      }

      orgBannerEl.hidden = true;
      if (orgBannerTextEl) {
        orgBannerTextEl.textContent = "You are viewing this organization";
      }
    };

    const disconnectOrganization = async () => {
      try {
        await clearSession();
      } catch (error) {
        console.warn("Failed to clear org session store:", error);
      }

      clearResourceCaches();
      clearFlowExecutionModelCache();
      clearInventoryStore();
      clearSessionActivities();
      dashboardFeatureRef?.disposeDashboard();
      Object.values(state.activeExports).forEach((controller) => controller?.abort());
      state.activeExports = {};
      state.exportRefreshConfigs = {};
      state.exportRefreshInFlight.clear();
      clearExportResults();
      setConnected(false);
      setToken("");
      setRegion("");
      setOrganizationName("");
      setOrganizationId("");
      if (regionSelect) {
        regionSelect.value = "";
      }
      setExportsEnabled(false);
      showStatus("Disconnected");
      syncConnectionUi();
    };

    const connectOrganization = async ({
      token,
      region,
      expectedOrganizationId = "",
      expectedOrganizationName = "",
    }) => {
      if (!token) {
        setExportsEnabled(false);
        showStatus("Token required");
        prependExportResult("Connection: Organization", "Token required", renderJsonBlock({ error: "Token required" }));
        return false;
      }

      if (!region) {
        setExportsEnabled(false);
        showStatus("Region required");
        prependExportResult("Connection: Organization", "Region required", renderJsonBlock({ error: "Region required" }));
        return false;
      }

      setToken(token);
      setRegion(region);
      showStatus("Connecting...");
      prependExportResult(
        "Connection: Organization",
        "Connecting...",
        renderJsonBlock({ status: "Connecting", region, hasToken: Boolean(token) })
      );

      try {
        const organization = await connect({ region, token });

        if (expectedOrganizationId && organization?.id !== expectedOrganizationId) {
          setConnected(false);
          setOrganizationName("");
          setExportsEnabled(false);
          const intendedName =
            expectedOrganizationName ||
            getOAuthIntendedOrganization().name ||
            expectedOrganizationId;
          const message = `The token is for "${organization?.name || organization?.id}", but "${intendedName}" was selected. Sign in again and choose the same client organization in Genesys when authorizing. If you see an access denied error, an admin must approve this OAuth client in that organization under Admin → Integrations → Authorized Applications.`;
          showStatus(message);
          prependExportResult("Connection: Organization", "Organization mismatch", renderJsonBlock({ error: message, organization }));
          return false;
        }

        setConnected(true);
        setOrganizationName(organization?.name || "");
        setOrganizationId(organization?.id || "");
        showStatus(organization?.name ? `Connected: ${organization.name}` : "Connected");
        syncConnectionUi();
        clearResourceCaches();
        clearFlowExecutionModelCache();
        clearInventoryStore();
        clearSessionActivities();
        clearExportResults();

        if (organization?.id) {
          try {
            await bindSession({
              orgId: organization.id,
              orgName: organization?.name || "",
              region,
            });
          } catch (error) {
            console.warn("Failed to bind org session store:", error);
          }
        }

        prependExportResult(
          "Connection: Organization",
          organization?.name ? `Connected: ${organization.name}` : "Connected",
          renderJsonBlock(organization)
        );
        return true;
      } catch (error) {
        setConnected(false);
        setOrganizationName("");
        setExportsEnabled(false);
        showStatus(error.message || "Connection failed");
        if (tokenInput) {
          tokenInput.disabled = false;
          tokenInput.value = getToken();
        }
        syncConnectionUi();
        prependExportResult(
          "Connection: Organization",
          error.message || "Connection failed",
          renderJsonBlock(error.payload || { error: error.message || "Connection failed" })
        );
        return false;
      }
    };

    const syncConnectionUi = () => {
      const connected = isConnected();
      const storedToken = getToken();

      setExportsEnabled(connected && Boolean(storedToken));

      if (tokenInput) {
        tokenInput.value = connected ? "" : storedToken;
        tokenInput.disabled = connected;
        tokenInput.style.backgroundColor = connected ? "#ece7de" : "#fff";
        tokenInput.style.cursor = connected ? "not-allowed" : "text";
      }

      if (connectBtn) {
        connectBtn.innerHTML = connected ? "Disconnect" : "Connect";
      }

      if (oauthLoginBtn) {
        oauthLoginBtn.disabled = connected;
      }

      syncOrgBanner();
    };

    const clearExportResults = () => {
      if (!resultsListEl) {
        return;
      }

      resultsListEl.innerHTML = "";
      state.exportData = {};
    };

    const prependExportResult = (title, status, html, exportId, isTableExport = false) => {
      if (!resultsListEl) {
        return;
      }

      Array.from(resultsListEl.querySelectorAll(".export-results")).forEach((section) => {
        if (section.tagName === "DETAILS") {
          section.open = false;
        }
      });

      const emptyState = resultsListEl.querySelector(".export-results--empty");
      if (emptyState) {
        emptyState.remove();
      }

      resultsListEl.insertAdjacentHTML(
        "afterbegin",
        renderExportSectionWithActions(title, status, html)
      );
    };

    const startExportResult = (title, status, html) => {
      if (!resultsListEl) {
        return null;
      }

      Array.from(resultsListEl.querySelectorAll(".export-results")).forEach((section) => {
        if (section.tagName === "DETAILS") {
          section.open = false;
        }
      });

      const emptyState = resultsListEl.querySelector(".export-results--empty");
      if (emptyState) {
        emptyState.remove();
      }

      const resultId = `export-result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      resultsListEl.insertAdjacentHTML(
        "afterbegin",
        `<details id="${resultId}" class="log-output export-results" open><summary class="export-results__summary"><span class="export-results__title">${escapeHtml(title)}</span><span class="muted">${escapeHtml(status)}</span></summary><div class="export-results__body">${html}</div></details>`
      );
      return resultId;
    };

    const finishExportResult = async (resultId, title, status, html, exportMeta) => {
      if (!resultsListEl || !resultId) {
        return;
      }

      const resultEl = document.getElementById(resultId);
      if (!resultEl) {
        return;
      }

      if (exportMeta) {
        state.exportData[resultId] = exportMeta;
      } else {
        delete state.exportData[resultId];
      }

      resultEl.outerHTML = finishExportMarkup(resultId, title, status, html, exportMeta);

      if (exportMeta?.rows?.length) {
        await persistExportToSession(resultId, exportMeta);
        if (exportMeta.sessionStored) {
          rerenderExportSection(resultId);
        } else {
          afterExportTableRender(resultId);
        }
      }

      const activityLabel = exportMeta?.exportType ? ACTIVITY_EXPORT_TYPES[exportMeta.exportType] : null;
      if (activityLabel && Array.isArray(exportMeta?.rows) && exportMeta.rows.length > 0) {
        recordSessionActivityFromResults(activityLabel, exportMeta.rows);
        dashboardFeatureRef?.refreshSessionActivity();
      }
    };

      const rerenderExportSection = (exportId) => {
      const exportMeta = state.exportData[exportId];
      const resultEl = document.getElementById(exportId);

      if (!exportMeta || !resultEl) {
        return;
      }

      const isOpen = resultEl.open;
      const savedScrollTops = captureBulkUserListScroll(resultEl);
      const savedFocus = captureFocusedField(resultEl);
      resultEl.outerHTML = finishExportMarkup(exportId, exportMeta.title, exportMeta.status, "", exportMeta);

      const nextEl = document.getElementById(exportId);
      if (nextEl) {
        nextEl.open = isOpen;
        restoreBulkUserListScroll(nextEl, savedScrollTops);
        restoreFocusedField(nextEl, savedFocus);
        afterExportTableRender(exportId);
      }
      };

      const moveSelectedColumn = (exportMeta, columnKey, direction) => {
        const currentIndex = exportMeta.selectedColumnKeys.indexOf(columnKey);
        if (currentIndex === -1) {
          return;
        }

        const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= exportMeta.selectedColumnKeys.length) {
          return;
        }

        const nextKeys = exportMeta.selectedColumnKeys.slice();
        const [movedKey] = nextKeys.splice(currentIndex, 1);
        nextKeys.splice(targetIndex, 0, movedKey);
        exportMeta.selectedColumnKeys = nextKeys;
      };

    const requireCredentials = (title) => {
      const token = getToken();
      const region = getRegionControlValue(regionSelect);

      if (!token) {
        prependExportResult(title, "Token required", '<p class="muted">Enter a token before running this export.</p>');
        return null;
      }

      if (!region) {
        prependExportResult(title, "Region required", '<p class="muted">Select a region before running this export.</p>');
        return null;
      }

      setToken(token);
      setRegion(region);
      return { token, region };
    };

    const wireExportButton = (button, config) => {
      if (!button) {
        return;
      }

      button.addEventListener("click", async () => {
        if (!state.hasConnection) {
          return;
        }

        const credentials = requireCredentials(config.title);
        if (!credentials) {
          return;
        }

        const loadingResultId = startExportResult(
          config.title,
          config.loadingStatus,
          renderLoadingState(config.loadingMessage)
        );

        try {
          const rows = await config.loader(credentials);
          const status = `Loaded ${rows.length} ${config.countLabel}`;
          finishExportResult(
            loadingResultId,
            config.title,
            status,
            "",
            config.createExportMeta(loadingResultId, rows, config.title, status)
          );
        } catch (error) {
          finishExportResult(
            loadingResultId,
            config.title,
            error.message || config.failureMessage,
            renderJsonBlock(error.payload || { error: error.message || config.failureMessage })
          );
        }
      });
    };

    const updateExportProgress = (resultId, progress, { cancellable = false } = {}) => {
      const resultEl = document.getElementById(resultId);
      const body = resultEl?.querySelector(".export-results__body");
      if (body) {
        body.innerHTML = renderExportProgressState({
          ...progress,
          resultId,
          cancellable,
        });
      }

      const statusEl = resultEl?.querySelector(".export-results__summary > .export-results__status");
      if (statusEl && progress.total > 0) {
        statusEl.textContent = `${progress.current} / ${progress.total} users`;
      }
    };

    const runProgressiveExport = async (resultId, config, { forceRefresh = false } = {}) => {
      const credentials = requireCredentials(config.title);
      if (!credentials) {
        return;
      }

      const controller = new AbortController();
      state.activeExports[resultId] = controller;
      updateExportProgress(
        resultId,
        {
          message: forceRefresh ? "Refreshing user data from Genesys..." : config.initialMessage,
          current: 0,
          total: 0,
        },
        { cancellable: !forceRefresh }
      );

      try {
        const { rows, cancelled, totalUsers, userCache } = await config.collector({
          credentials,
          signal: controller.signal,
          forceRefresh,
          onProgress: (progress) => updateExportProgress(resultId, progress, { cancellable: !forceRefresh }),
        });
        const statusBase = buildProgressiveExportStatusParts(rows, { cancelled, totalUsers });
        const exportMeta = {
          ...config.createExportMeta(resultId, rows, config.title, statusBase),
          userCache,
          statusBase,
          status: statusBase,
        };

        state.exportRefreshConfigs[resultId] = config;
        await finishExportResult(resultId, config.title, statusBase, "", exportMeta);
      } catch (error) {
        if (error?.name === "AbortError" || controller.signal.aborted) {
          const statusBase = buildProgressiveExportStatusParts([], { cancelled: true, totalUsers: 0 });
          await finishExportResult(
            resultId,
            config.title,
            statusBase,
            "",
            {
              ...config.createExportMeta(resultId, [], config.title, statusBase),
              statusBase,
              status: statusBase,
            }
          );
          return;
        }

        await finishExportResult(
          resultId,
          config.title,
          error.message || config.failureMessage,
          renderJsonBlock(error.payload || { error: error.message || config.failureMessage })
        );
      } finally {
        delete state.activeExports[resultId];
      }
    };

    const refreshProgressiveExport = async (resultId) => {
      const config = state.exportRefreshConfigs[resultId];
      if (!config || state.exportRefreshInFlight.has(resultId)) {
        return;
      }

      state.exportRefreshInFlight.add(resultId);
      try {
        await runProgressiveExport(resultId, config, { forceRefresh: true });
      } finally {
        state.exportRefreshInFlight.delete(resultId);
      }
    };

    const refreshBulkUserCache = async (resultId) => {
      const exportMeta = state.exportData[resultId];
      if (!exportMeta?.userCache || !Array.isArray(exportMeta.users) || state.exportRefreshInFlight.has(resultId)) {
        return;
      }

      const credentials = requireCredentials(exportMeta.title);
      if (!credentials) {
        return;
      }

      state.exportRefreshInFlight.add(resultId);
      const resultEl = document.getElementById(resultId);
      const bodyEl = resultEl?.querySelector(".export-results__body");
      const previousBody = bodyEl?.innerHTML || "";

      if (bodyEl) {
        bodyEl.innerHTML = renderLoadingState("Refreshing user data from Genesys...");
      }

      try {
        const { users, cache: userCache } = await loadSessionUsers({
          ...credentials,
          force: true,
          onProgress: (progress) => {
            const statusEl = resultEl?.querySelector(".export-results__status");
            if (statusEl) {
              statusEl.textContent = progress.message || "Refreshing user data from Genesys...";
            }
          },
        });

        exportMeta.users = users
          .slice()
          .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
        exportMeta.userCache = userCache;
        rerenderExportSection(resultId);
      } catch (error) {
        if (bodyEl) {
          bodyEl.innerHTML = previousBody;
        }
        prependExportResult(
          exportMeta.title,
          error.message || "User cache refresh failed",
          renderJsonBlock(error.payload || { error: error.message || "User cache refresh failed" })
        );
      } finally {
        state.exportRefreshInFlight.delete(resultId);
      }
    };

    const refreshExportUserCache = async (resultId) => {
      if (state.exportRefreshConfigs[resultId]) {
        await refreshProgressiveExport(resultId);
        return;
      }

      await refreshBulkUserCache(resultId);
    };

    const wireProgressiveUserExportButton = (button, config) => {
      if (!button) {
        return;
      }

      button.addEventListener("click", async () => {
        if (!state.hasConnection) {
          return;
        }

        const loadingResultId = startExportResult(
          config.title,
          config.loadingStatus,
          renderExportProgressState({
            message: config.initialMessage,
            current: 0,
            total: 0,
          })
        );

        await runProgressiveExport(loadingResultId, config);
      });
    };

    const renderSelectorOptions = (items, placeholder) => {
      const placeholderOption = `<option value="">${escapeHtml(placeholder)}</option>`;
      const options = items
        .map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
        .join("");

      return `${placeholderOption}${options}`;
    };

    const wireSelectorExportButton = (button, config) => {
      if (!button) {
        return;
      }

      button.addEventListener("click", async () => {
        if (!state.hasConnection) {
          return;
        }

        const credentials = requireCredentials(config.selectorTitle);
        if (!credentials) {
          return;
        }

        const loadingResultId = startExportResult(
          config.selectorTitle,
          config.selectorLoadingStatus,
          renderLoadingState(config.selectorLoadingMessage)
        );

        try {
          const items = await config.listLoader(credentials);
          const selectorItems = config.mapItems(items);
          finishExportResult(
            loadingResultId,
            config.selectorTitle,
            `Loaded ${selectorItems.length} choices`,
            `<div class="column-editor"><div class="column-editor__header">${escapeHtml(config.selectorLabel)}</div><div class="sidebar-actions">${renderGuxFieldSelect({
              escapeHtml,
              inputId: `${loadingResultId}-select`,
              className: "export-selector-selection",
              label: config.selectorLabel,
              optionsHtml: renderSelectorOptions(selectorItems, config.selectorPlaceholder),
              attrs: `data-result-id="${escapeHtml(loadingResultId)}" data-export-kind="${escapeHtml(config.exportKind)}"`,
            })}<gux-button class="export-load-button" type="button" accent="primary" data-result-id="${escapeHtml(
              loadingResultId
            )}" data-export-kind="${escapeHtml(config.exportKind)}">Load</gux-button></div></div>`
          );

          state.exportData[loadingResultId] = {
            kind: config.exportKind,
            items: selectorItems,
            title: config.exportTitle,
            status: config.exportLoadingStatus,
          };
        } catch (error) {
          finishExportResult(
            loadingResultId,
            config.selectorTitle,
            error.message || config.selectorFailureMessage,
            renderJsonBlock(error.payload || { error: error.message || config.selectorFailureMessage })
          );
        }
      });
    };

    const confirmModal = createConfirmModal({
      modalEl: confirmModalEl,
      titleEl: confirmModalTitleEl,
      bodyEl: confirmModalBodyEl,
      cancelBtn: confirmModalCancelBtn,
      confirmBtn: confirmModalConfirmBtn,
    });
    confirmModal.bind();

    const orgPickerModal = createOrgPickerModal({
      modalEl: orgPickerModalEl,
      searchInputEl: orgPickerSearchEl,
      listEl: orgPickerListEl,
      statusEl: orgPickerStatusEl,
      cancelBtn: orgPickerCancelBtn,
      signInBtn: orgPickerSignInBtn,
    });
    orgPickerModal.bind();

    const capturePreferredTargetOrgFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const targetOrg = params.get("targetOrg") || params.get("genesysTargetOrg") || "";

      if (!targetOrg) {
        return "";
      }

      setPreferredTargetOrg(targetOrg);

      if (window.history?.replaceState) {
        params.delete("targetOrg");
        params.delete("genesysTargetOrg");
        const query = params.toString();
        const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", nextUrl);
      }

      return targetOrg;
    };

    capturePreferredTargetOrgFromUrl();

    const getRegionDomain = (regionId) => {
      const matchedRegion = state.regions.find((entry) => entry.id === regionId);
      return matchedRegion?.domain || "";
    };

    const loadAccessibleOrganizationsForPicker = async ({ region, token }) => {
      try {
        return await getAccessibleOrganizations({ region, token });
      } catch (error) {
        setToken("");
        throw error;
      }
    };

    const buildOrganizationPickerStatus = ({
      statusMessage = "",
      trustorsError = "",
      authorizedOrganizationCount = 0,
      trustorsLoaded = 0,
    }) => {
      if (statusMessage) {
        return statusMessage;
      }

      if (trustorsError) {
        return `${trustorsError} Add organization-authorization:readonly to the OAuth client scopes, ensure your role includes Org Trustor View, then sign in again. You can also configure GENESYS_AUTHORIZED_ORGS or paste an organization ID.`;
      }

      if (authorizedOrganizationCount === 0 && trustorsLoaded === 0) {
        return "No authorized client organizations were returned. Confirm org pairings exist in Genesys Admin, or configure GENESYS_AUTHORIZED_ORGS in the environment.";
      }

      return "Select the organization you want this tool to connect to.";
    };

    const promptForOrganizationSelection = async ({
      region,
      token = "",
      initialSearch = "",
      statusMessage = "",
    }) => {
      let organizations = [];
      let currentOrganizationId = "";
      let trustorsError = "";
      let authorizedOrganizationCount = 0;
      let trustorsLoaded = 0;

      const selectionPromise = new Promise((resolve) => {
        orgPickerModal.open({
          organizations,
          currentOrganizationId,
          initialSearch,
          statusMessage: token
            ? "Loading accessible organizations..."
            : buildOrganizationPickerStatus({ statusMessage }),
          showSignIn: !token,
          onSelect: (organization) => {
            resolve({ action: "select", organization, currentOrganizationId });
          },
          onSignIn: () => {
            resolve({ action: "sign-in" });
          },
          onCancel: () => {
            resolve(null);
          },
        });
      });

      if (token) {
        try {
          const payload = await loadAccessibleOrganizationsForPicker({ region, token });
          organizations = payload.organizations;
          currentOrganizationId = payload.currentOrganizationId;
          trustorsError = payload.trustorsError || "";
          authorizedOrganizationCount = payload.authorizedOrganizationCount || 0;
          trustorsLoaded = payload.trustorsLoaded || 0;

          orgPickerModal.update({
            organizations,
            currentOrganizationId,
            statusMessage: buildOrganizationPickerStatus({
              statusMessage,
              trustorsError,
              authorizedOrganizationCount,
              trustorsLoaded,
            }),
            showSignIn: true,
          });
        } catch (error) {
          orgPickerModal.update({
            organizations: [],
            currentOrganizationId: "",
            statusMessage: buildOrganizationPickerStatus({
              statusMessage: error.message || "Unable to load organizations.",
              trustorsError: error.message || "",
            }),
            showSignIn: true,
          });
        }
      }

      return selectionPromise;
    };

    const authorizeForOrganization = async ({ organization, currentOrganizationId, region, token = getToken() }) => {
      const domain = getRegionDomain(region);

      if (!domain) {
        throw new Error("Select a valid region before connecting.");
      }

      setPreferredTargetOrg(organization.id);

      if (token && organization.id === currentOrganizationId) {
        await openDashboardAfterConnect(
          await connectOrganization({ token, region, expectedOrganizationId: organization.id })
        );
        return;
      }

      setToken("");
      setConnected(false);
      setOrganizationName("");
      setOrganizationId("");
      clearExportResults();
      try {
        await clearSession();
      } catch (error) {
        console.warn("Failed to clear org session store:", error);
      }
      syncConnectionUi();

      const config = await getOAuthConfig();
      const isPrimaryOrganization = organization.id === config.primaryOrgId;

      if (isPrimaryOrganization) {
        showStatus(`Redirecting to authorize ${organization.name}...`);
        await startPkceLogin({
          region,
          domain,
          targetOrgId: organization.id,
          phase: OAUTH_PHASE_CONNECT,
        });
        return;
      }

      showStatus(
        `Redirecting to authorize ${organization.name}. Genesys will open that client organization. Approve this application if an admin has not already authorized it.`
      );
      await startClientOrgLogin({
        region,
        domain,
        intendedOrgId: organization.id,
        intendedOrgName: organization.name,
      });
    };

    const presentOrganizationPickerFlow = async ({
      region,
      token,
      initialSearch = "",
      statusMessage = "",
    }) => {
      const selection = await promptForOrganizationSelection({
        region,
        token,
        initialSearch,
        statusMessage,
      });

      if (!selection) {
        showStatus("Organization selection cancelled.");
        return;
      }

      if (selection.action === "sign-in") {
        const domain = getRegionDomain(region);
        showStatus("Redirecting to primary organization login...");
        await startPrimaryOrgLogin({ region, domain });
        return;
      }

      await authorizeForOrganization({
        organization: selection.organization,
        currentOrganizationId: selection.currentOrganizationId,
        region,
        token,
      });
    };

    const beginPkceOrganizationSelection = async () => {
      clearOAuthAutoConnect();
      clearOAuthIntendedOrganization();
      clearOAuthError();

      const region = getRegionControlValue(regionSelect);

      if (!region) {
        showStatus("Region required");
        prependExportResult(
          "Connection: Authorization",
          "Region required",
          renderJsonBlock({ error: "Select a region before authorizing with PKCE." })
        );
        return;
      }

      const domain = getRegionDomain(region);

      if (!domain) {
        showStatus("Region required");
        prependExportResult(
          "Connection: Authorization",
          "Region required",
          renderJsonBlock({ error: "Select a valid region before authorizing with PKCE." })
        );
        return;
      }

      const preferredTargetOrg = getPreferredTargetOrg();
      const existingToken = getToken();

      if (existingToken) {
        try {
          await presentOrganizationPickerFlow({
            region,
            token: existingToken,
            initialSearch: preferredTargetOrg,
          });
          return;
        } catch (error) {
          setToken("");
          showStatus(error.message || "Session expired. Signing in to primary organization...");
        }
      }

      showStatus("Redirecting to primary organization login...");
      await startPrimaryOrgLogin({ region, domain });
    };

    const resumeOrganizationPickerAfterOAuth = async () => {
      const region = getRegion();
      const token = getToken();

      clearOAuthPendingOrgPicker();

      if (!region || !token) {
        showStatus("Authorization incomplete.");
        return;
      }

      if (tokenInput) {
        tokenInput.value = token;
      }

      try {
        await presentOrganizationPickerFlow({
          region,
          token,
          initialSearch: getPreferredTargetOrg(),
          statusMessage:
            "Primary organization sign-in complete. Select the client organization you want this tool to connect to.",
        });
      } catch (error) {
        showStatus(error.message || "Failed to load accessible organizations.");
        prependExportResult(
          "Connection: Authorization",
          error.message || "Failed to load accessible organizations.",
          renderJsonBlock({ error: error.message || "Failed to load accessible organizations." })
        );
      }
    };

    const loadCachedPhonesForSession = (credentials, options) =>
      getCachedPhones(credentials, getPhones, options);
    const loadCachedRolesForSession = (credentials, options) =>
      getCachedRoles(credentials, getRoles, options);
    const loadCachedQueuesForSession = (credentials, options) =>
      getCachedQueues(credentials, getQueues, options);
    const loadCachedSkillsForSession = (credentials, options) =>
      getCachedSkills(credentials, getSkills, options);
    const loadCachedGroupsForSession = (credentials, options) =>
      getCachedGroups(credentials, getGroups, options);
    const loadCachedSitesForSession = (credentials) => getCachedSites(credentials, getSites);
    const loadCachedDataTablesForSession = (credentials) => getCachedDataTables(credentials, getDataTables);

    const bulkSkillAssignFeature = createBulkSkillAssignFeature({
      state,
      getSkills: loadCachedSkillsForSession,
      loadSessionUsers,
      assignRoutingSkillsToUsers,
      requireCredentials,
      startExportResult,
      finishExportResult,
      rerenderExportSection,
      prependExportResult,
      renderLoadingState,
      renderJsonBlock,
      confirmModal,
    });

    const bulkRoleAssignFeature = createBulkRoleAssignFeature({
      state,
      getRoles: loadCachedRolesForSession,
      getDivisions,
      loadSessionUsers,
      assignUsersToRoleDivision,
      requireCredentials,
      startExportResult,
      finishExportResult,
      rerenderExportSection,
      prependExportResult,
      renderLoadingState,
      renderJsonBlock,
      confirmModal,
    });

    const passwordResetWorkflow = createPasswordResetWorkflow({
      createRandomPassword,
      describePasswordPolicy,
      normalizePasswordPolicy,
      validatePasswordAgainstPolicy,
    });

    const bulkAutoAnswerFeature = createBulkAutoAnswerFeature({
      state,
      loadSessionUsers,
      setUsersAutoAnswer,
      requireCredentials,
      startExportResult,
      finishExportResult,
      rerenderExportSection,
      prependExportResult,
      renderLoadingState,
      renderJsonBlock,
      confirmModal,
    });

    const bulkPasswordResetFeature = createBulkPasswordResetFeature({
      state,
      loadSessionUsers,
      getPasswordPolicy,
      resetUsersPasswords,
      passwordResetWorkflow,
      requireCredentials,
      startExportResult,
      finishExportResult,
      rerenderExportSection,
      prependExportResult,
      renderLoadingState,
      renderJsonBlock,
      confirmModal,
    });

    const bulkLogoffFeature = createBulkLogoffFeature({
      state,
      loadSessionUsers,
      logoffUsers,
      requireCredentials,
      startExportResult,
      finishExportResult,
      rerenderExportSection,
      prependExportResult,
      renderLoadingState,
      renderJsonBlock,
      confirmModal,
    });

    const bulkDisconnectFeature = createBulkDisconnectFeature({
      state,
      getQueues: loadCachedQueuesForSession,
      queryOpenQueueInteractions,
      disconnectConversations,
      requireCredentials,
      startExportResult,
      finishExportResult,
      rerenderExportSection,
      prependExportResult,
      renderLoadingState,
      renderJsonBlock,
      renderEditableTableContent,
      confirmModal,
      getCurrentAppDomain,
    });

    const bulkPhoneBuildFeature = createBulkPhoneBuildFeature({
      state,
      loadSessionUsers,
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
    });

    const dataTableExportFeature = createDataTableExportFeature({
      state,
      getCachedDataTables: loadCachedDataTablesForSession,
      exportDataTables,
      requireCredentials,
      startExportResult,
      finishExportResult,
      rerenderExportSection,
      prependExportResult,
      renderLoadingState,
      renderJsonBlock,
      renderExportProgressState,
    });

    const bulkPhoneMoveFeature = createBulkPhoneMoveFeature({
      state,
      getCachedPhones: loadCachedPhonesForSession,
      getCachedSites: loadCachedSitesForSession,
      movePhonesToSite,
      requireCredentials,
      startExportResult,
      finishExportResult,
      rerenderExportSection,
      prependExportResult,
      renderLoadingState,
      renderJsonBlock,
      confirmModal,
    });

    const bulkPhoneRemoveFeature = createBulkPhoneRemoveFeature({
      state,
      getCachedPhones: loadCachedPhonesForSession,
      deletePhones,
      requireCredentials,
      startExportResult,
      finishExportResult,
      rerenderExportSection,
      prependExportResult,
      renderLoadingState,
      renderJsonBlock,
      confirmModal,
    });

    const bulkPhoneSiteMigrateFeature = createBulkPhoneSiteMigrateFeature({
      state,
      getCachedPhones: loadCachedPhonesForSession,
      getCachedSites: loadCachedSitesForSession,
      movePhonesToSite,
      requireCredentials,
      startExportResult,
      finishExportResult,
      rerenderExportSection,
      prependExportResult,
      renderLoadingState,
      renderJsonBlock,
      confirmModal,
    });

    const bulkPriorityUpdateFeature = createBulkPriorityUpdateFeature({
      state,
      getQueues: loadCachedQueuesForSession,
      queryOpenQueueInteractions,
      updateConversationPriorities,
      requireCredentials,
      startExportResult,
      finishExportResult,
      rerenderExportSection,
      prependExportResult,
      renderLoadingState,
      renderJsonBlock,
      renderEditableTableContent,
      confirmModal,
      getCurrentAppDomain,
    });

    dashboardFeatureRef = createDashboardFeature({
      state,
      requireCredentials,
      startExportResult,
      finishExportResult,
      clearExportResults,
      renderLoadingState,
      getOrganizationName,
      getOrganizationId,
      getRegion,
      getConnectedAt,
      fetchUserSyncStatus,
      fetchCachedUsers,
      fetchSessionStatus,
      getCurrentUser,
      getOrganizationLimits,
      getTelephonyCallMetrics,
      loadCachedRoles: loadCachedRolesForSession,
      loadCachedQueues: loadCachedQueuesForSession,
      loadCachedSkills: loadCachedSkillsForSession,
      loadCachedGroups: loadCachedGroupsForSession,
      getPrompts,
      getQueueMembers,
      loadCachedPhones: loadCachedPhonesForSession,
      loadCachedDataTables: loadCachedDataTablesForSession,
      peekCachedPhones,
      syncSessionUsers,
    });

    const openDashboardAfterConnect = async (connected) => {
      if (connected) {
        await dashboardFeatureRef?.openDashboard();
      }
    };

    const loadSchedulesFeature = createLoadSchedulesFeature({
      state,
      mapNamedOptions,
      getDivisions,
      getScheduleTemplates,
      loadSchedules,
      requireCredentials,
      startExportResult,
      finishExportResult,
      rerenderExportSection,
      renderLoadingState,
      renderJsonBlock,
      summarizeBulkStatuses,
      createLoadSchedulesResultsMeta,
      confirmModal,
    });

    const masterAdminFeature = createMasterAdminFeature({
      state,
      createMasterAdminRole,
      requireCredentials,
      startExportResult,
      finishExportResult,
      renderLoadingState,
      renderJsonBlock,
      createMasterAdminResultsMeta,
      confirmModal,
    });

    const sharedCallSpoofFormHelpers = {
      loadFieldHistory,
      rememberFieldHistory,
      renderGuxPhoneField,
      renderGuxTextField,
      renderGuxTextareaField,
      renderGuxDateTimeField,
      renderGuxTimezoneDropdown,
      readControlValue,
      resolveFieldClass,
      formatDateTimeForAttribute,
      parseCustomAttributesText,
      toDateTimeLocalValue,
    };

    const outboundCallSpoofFeature = createOutboundCallSpoofFeature({
      state,
      spoofOutboundCall,
      requireCredentials,
      startExportResult,
      finishExportResult,
      renderLoadingState,
      renderJsonBlock,
      createOutboundCallSpoofResultsMeta,
      confirmModal,
      ...sharedCallSpoofFormHelpers,
    });

    const inboundCallSpoofFeature = createInboundCallSpoofFeature({
      state,
      getCurrentUser,
      spoofInboundCall,
      requireCredentials,
      startExportResult,
      finishExportResult,
      renderLoadingState,
      renderJsonBlock,
      createInboundCallSpoofResultsMeta,
      confirmModal,
      ...sharedCallSpoofFormHelpers,
    });

    const intentHealthFeature = createIntentHealthFeature({
      state,
      getBotFlows,
      getIntentHealth,
      mapBotFlowOptions,
      getSelectedBotFlow,
      validatePublishedBotFlow,
      requireCredentials,
      startExportResult,
      finishExportResult,
      renderLoadingState,
      renderJsonBlock,
      createIntentHealthResultsMeta,
      renderEditableTableContent,
    });

    const utterancesFeature = createUtterancesFeature({
      state,
      getBotFlows,
      getBotUtterances,
      mapBotFlowOptions,
      getSelectedBotFlow,
      validatePublishedBotFlow,
      requireCredentials,
      startExportResult,
      finishExportResult,
      renderLoadingState,
      renderJsonBlock,
      createUtterancesResultsMeta,
      getCurrentAppDomain,
      renderEditableTableContent,
    });

    const auditLogViewerFeature = createAuditLogViewerFeature({
      state,
      getAuditServiceMapping,
      createAuditQuery,
      getAuditQueryStatus,
      getAuditQueryResults,
      requireCredentials,
      startExportResult,
      finishExportResult,
      renderLoadingState,
      renderJsonBlock,
    });

    const mockApiFeature = createMockApiFeature({
      state,
      requireCredentials,
      startExportResult,
      finishExportResult,
      renderLoadingState,
      renderJsonBlock,
      confirmModal,
    });

    const flowExecutionFeature = createFlowExecutionFeature({
      state,
      requireCredentials,
      getCurrentAppDomain,
      startExportResult,
      finishExportResult,
      renderLoadingState,
      renderJsonBlock,
      confirmModal,
    });

    const notificationMessageParserFeature = createNotificationMessageParserFeature({
      state,
      startExportResult,
      finishExportResult,
      renderLoadingState,
    });

    const notificationSubscriptionDeps = {
      state,
      getAvailableNotificationTopics,
      createNotificationChannel,
      subscribeNotificationTopics,
      deleteNotificationChannel,
      requireCredentials,
      startExportResult,
      finishExportResult,
      rerenderExportSection,
      renderLoadingState,
      openNotificationMessageParser: () => notificationMessageParserFeature.openParserPanel(),
    };

    const userNotificationsFeature = createUserNotificationsFeature({
      ...notificationSubscriptionDeps,
      getCurrentUser,
      getUser,
    });

    const queueNotificationsFeature = createQueueNotificationsFeature({
      ...notificationSubscriptionDeps,
      getCachedQueues: loadCachedQueuesForSession,
      getQueues,
    });

    const outboundNotificationsFeature = createOutboundNotificationsFeature({
      ...notificationSubscriptionDeps,
      getCampaigns,
    });

    if (resultsListEl) {
      resultsListEl.addEventListener("click", async (event) => {
        if (await bulkSkillAssignFeature.handleClick(event)) {
          return;
        }

        if (await bulkRoleAssignFeature.handleClick(event)) {
          return;
        }

        if (await bulkAutoAnswerFeature.handleClick(event)) {
          return;
        }

        if (await bulkPasswordResetFeature.handleClick(event)) {
          return;
        }

        if (await bulkLogoffFeature.handleClick(event)) {
          return;
        }

        if (await bulkDisconnectFeature.handleClick(event)) {
          return;
        }

        if (await bulkPriorityUpdateFeature.handleClick(event)) {
          return;
        }

        if (await bulkPhoneBuildFeature.handleClick(event)) {
          return;
        }

        if (await bulkPhoneMoveFeature.handleClick(event)) {
          return;
        }

        if (await bulkPhoneRemoveFeature.handleClick(event)) {
          return;
        }

        if (await bulkPhoneSiteMigrateFeature.handleClick(event)) {
          return;
        }

        if (await dataTableExportFeature.handleClick(event)) {
          return;
        }

        if (await loadSchedulesFeature.handleClick(event)) {
          return;
        }

        if (await masterAdminFeature.handleClick(event)) {
          return;
        }

        if (await outboundCallSpoofFeature.handleClick(event)) {
          return;
        }

        if (await inboundCallSpoofFeature.handleClick(event)) {
          return;
        }

        if (await intentHealthFeature.handleClick(event)) {
          return;
        }

        if (await utterancesFeature.handleClick(event)) {
          return;
        }

        if (await auditLogViewerFeature.handleClick(event)) {
          return;
        }

        if (await mockApiFeature.handleClick(event)) {
          return;
        }

        if (await flowExecutionFeature.handleClick(event)) {
          return;
        }

        if (await userNotificationsFeature.handleClick(event)) {
          return;
        }

        if (await queueNotificationsFeature.handleClick(event)) {
          return;
        }

        if (await outboundNotificationsFeature.handleClick(event)) {
          return;
        }

        if (await notificationMessageParserFeature.handleClick(event)) {
          return;
        }

        const cancelExportButton = findClickControl(event, "export-progress-cancel");
        if (cancelExportButton) {
          event.preventDefault();
          event.stopPropagation();

          const resultId = cancelExportButton.getAttribute("data-result-id");
          const controller = resultId ? state.activeExports[resultId] : null;
          if (controller) {
            controller.abort();
            updateExportProgress(
              resultId,
              {
                message: "Cancelling export...",
                current: 0,
                total: 0,
              },
              { cancellable: false }
            );
          }
          return;
        }

        const userCacheRefreshLink = findClickControl(event, "user-cache-refresh");
        if (userCacheRefreshLink) {
          event.preventDefault();
          event.stopPropagation();

          const resultId = userCacheRefreshLink.getAttribute("data-result-id");
          if (resultId) {
            await refreshExportUserCache(resultId);
          }
          return;
        }

        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const editButton = target.closest(".export-edit-button");
        if (editButton) {
          event.preventDefault();
          event.stopPropagation();

          const exportId = editButton.getAttribute("data-export-id");
          if (!exportId || !state.exportData[exportId]) {
            return;
          }

          state.exportData[exportId].editMode = !state.exportData[exportId].editMode;
          rerenderExportSection(exportId);
          return;
        }

        const moveButton = target.closest(".column-move-button");
        if (moveButton) {
          event.preventDefault();
          event.stopPropagation();

          const exportId = moveButton.getAttribute("data-export-id");
          const columnKey = moveButton.getAttribute("data-column-key");
          const direction = moveButton.getAttribute("data-direction");
          const exportMeta = exportId ? state.exportData[exportId] : null;

          if (!exportMeta || !columnKey || !direction) {
            return;
          }

          moveSelectedColumn(exportMeta, columnKey, direction);
          rerenderExportSection(exportId);
          return;
        }

        const downloadButton = target.closest(".export-download-button");
        if (downloadButton) {
          event.preventDefault();
          event.stopPropagation();

          const exportId = downloadButton.getAttribute("data-export-id");
          if (exportId) {
            await downloadCsv(exportId);
          }
          return;
        }

        const sessionLoadMoreButton = target.closest(".export-session-load-more");
        if (sessionLoadMoreButton) {
          event.preventDefault();
          event.stopPropagation();

          const exportId = sessionLoadMoreButton.getAttribute("data-export-id");
          const exportMeta = exportId ? state.exportData[exportId] : null;
          if (!exportId || !exportMeta?.sessionStored) {
            return;
          }

          try {
            const payload = await fetchExportRows({
              exportId,
              offset: exportMeta.sessionRowsLoaded || exportMeta.rows.length,
              limit: SESSION_ROW_PAGE_SIZE,
            });
            exportMeta.rows = [...(exportMeta.rows || []), ...(payload.rows || [])];
            exportMeta.sessionRowsLoaded = exportMeta.rows.length;
            rerenderExportSection(exportId);
          } catch (error) {
            console.warn("Failed to load more session rows:", error);
          }
          return;
        }

        const loadButton = target.closest(".export-load-button");
        if (!loadButton) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const resultId = loadButton.getAttribute("data-result-id");
        const exportKind = loadButton.getAttribute("data-export-kind");
        const resultEl = resultId ? document.getElementById(resultId) : null;

        if (!resultId || !resultEl) {
          return;
        }

        const selectedId = readControlValue(resultEl, "export-selector-selection");
        const selectorMeta = state.exportData[resultId];
        if (!selectedId || !selectorMeta) {
          return;
        }

        const credentials = requireCredentials(selectorMeta.title);
        if (!credentials) {
          return;
        }

        const selectedItem = selectorMeta.items.find((item) => item.value === selectedId);
        resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
          exportKind === "queue-members"
            ? `Fetching members for "${selectedItem?.label || selectedId}"...`
            : `Fetching members for "${selectedItem?.label || selectedId}"...`
        );

        const run = async () => {
          if (exportKind === "queue-members") {
            const members = await getQueueMembers({ ...credentials, queueId: selectedId });
            const title = `Export: Queue Members - ${selectedItem?.label || selectedId}`;
            const status = `Loaded ${members.length} members`;
            finishExportResult(
              resultId,
              title,
              status,
              "",
              createQueueMembersExportMeta(resultId, members, title, status)
            );
            return;
          }

          if (exportKind === "group-members") {
            const members = await getGroupMembers({ ...credentials, groupId: selectedId });
            const title = `Export: Group Members - ${selectedItem?.label || selectedId}`;
            const status = `Loaded ${members.length} members`;
            finishExportResult(
              resultId,
              title,
              status,
              "",
              createGroupMembersExportMeta(resultId, members, title, status)
            );
          }
        };

        run().catch((error) => {
          finishExportResult(
            resultId,
            selectorMeta.title,
            error.message || "Selector export failed",
            renderJsonBlock(error.payload || { error: error.message || "Selector export failed" })
          );
        });
      });

      resultsListEl.addEventListener("guxactivetabchange", (event) => {
        if (loadSchedulesFeature.handleTabActivate(event)) {
          return;
        }
      });

      resultsListEl.addEventListener("input", (event) => {
        if (loadSchedulesFeature.handleInput(event)) {
          return;
        }

        if (userNotificationsFeature.handleInput?.(event)) {
          return;
        }

        if (queueNotificationsFeature.handleInput?.(event)) {
          return;
        }

        if (outboundNotificationsFeature.handleInput?.(event)) {
          return;
        }
      });

      resultsListEl.addEventListener("change", (event) => {
        if (bulkSkillAssignFeature.handleChange(event)) {
          return;
        }

        if (bulkRoleAssignFeature.handleChange(event)) {
          return;
        }

        if (bulkAutoAnswerFeature.handleChange(event)) {
          return;
        }

        if (bulkPasswordResetFeature.handleChange(event)) {
          return;
        }

        if (bulkLogoffFeature.handleChange(event)) {
          return;
        }

        if (bulkDisconnectFeature.handleChange(event)) {
          return;
        }

        if (bulkPriorityUpdateFeature.handleChange(event)) {
          return;
        }

        if (bulkPhoneBuildFeature.handleChange(event)) {
          return;
        }

        if (bulkPhoneMoveFeature.handleChange(event)) {
          return;
        }

        if (bulkPhoneRemoveFeature.handleChange(event)) {
          return;
        }

        if (bulkPhoneSiteMigrateFeature.handleChange(event)) {
          return;
        }

        if (dataTableExportFeature.handleChange(event)) {
          return;
        }

        if (loadSchedulesFeature.handleChange(event)) {
          return;
        }

        if (masterAdminFeature.handleChange(event)) {
          return;
        }

        if (outboundCallSpoofFeature.handleChange(event)) {
          return;
        }

        if (inboundCallSpoofFeature.handleChange(event)) {
          return;
        }

        if (intentHealthFeature.handleChange(event)) {
          return;
        }

        if (utterancesFeature.handleChange(event)) {
          return;
        }

        if (auditLogViewerFeature.handleChange(event)) {
          return;
        }

        if (flowExecutionFeature.handleChange(event)) {
          return;
        }

        if (userNotificationsFeature.handleChange(event)) {
          return;
        }

        if (queueNotificationsFeature.handleChange(event)) {
          return;
        }

        if (outboundNotificationsFeature.handleChange(event)) {
          return;
        }

        const target = event.target;
        const columnToggleClass = resolveFieldClass(target, ["column-toggle"]);
        if (!columnToggleClass) {
          return;
        }

        const fieldControl = target.closest(".column-toggle") || target;
        const exportId = fieldControl.getAttribute("data-export-id");
        const columnKey = fieldControl.getAttribute("data-column-key");
        const exportMeta = exportId ? state.exportData[exportId] : null;

        if (!exportMeta || !columnKey || !(fieldControl instanceof HTMLInputElement)) {
          return;
        }
        if (fieldControl.checked) {
          if (!exportMeta.selectedColumnKeys.includes(columnKey)) {
            exportMeta.selectedColumnKeys.push(columnKey);
          }
        } else {
          exportMeta.selectedColumnKeys = exportMeta.selectedColumnKeys.filter((key) => key !== columnKey);
        }

        rerenderExportSection(exportId);
      });
    }

    if (orgBannerDisconnectBtn) {
      orgBannerDisconnectBtn.addEventListener("click", async () => {
        if (isConnected()) {
          await disconnectOrganization();
        }
      });
    }

    if (connectBtn) {
      connectBtn.addEventListener("click", async () => {
        if (isConnected()) {
          await disconnectOrganization();
          return;
        }

        const token = tokenInput ? tokenInput.value.trim() : "";
        const region = getRegionControlValue(regionSelect);
        await openDashboardAfterConnect(await connectOrganization({ token, region }));
      });
    }

    if (oauthLoginBtn) {
      oauthLoginBtn.addEventListener("click", async () => {
        if (isConnected()) {
          return;
        }

        try {
          await beginPkceOrganizationSelection();
        } catch (error) {
          showStatus(error.message || "Authorization failed");
          prependExportResult(
            "Connection: Authorization",
            error.message || "Authorization failed",
            renderJsonBlock({ error: error.message || "Authorization failed" })
          );
        }
      });
    }

    wireProgressiveUserExportButton(usersBtn, {
      title: "Export: Users",
      loadingStatus: "Loading users...",
      initialMessage: 'Fetching "/api/v2/users"...',
      failureMessage: "Users export failed",
      collector: async ({ credentials, onProgress, signal, forceRefresh }) => {
        const { users: rows, cache: userCache } = await loadSessionUsers({
          ...credentials,
          onProgress,
          signal,
          force: Boolean(forceRefresh),
        });

        return {
          rows,
          cancelled: Boolean(signal?.aborted),
          totalUsers: rows.length,
          userCache,
        };
      },
      createExportMeta: createUsersExportMeta,
    });

    wireProgressiveUserExportButton(userRolesBtn, {
      title: "Export: User Roles",
      loadingStatus: "Loading user role mappings...",
      initialMessage: 'Fetching "/api/v2/users"...',
      failureMessage: "User role mappings export failed",
      collector: (options) =>
        collectUserRoleMappings({
          ...options,
          loadSessionUsers,
          getAuthorizationSubject,
        }),
      createExportMeta: createUserRoleMappingsExportMeta,
    });

    wireProgressiveUserExportButton(userSkillsBtn, {
      title: "Export: User Skills",
      loadingStatus: "Loading user skill mappings...",
      initialMessage: 'Fetching "/api/v2/users"...',
      failureMessage: "User skill mappings export failed",
      collector: (options) =>
        collectUserSkillMappings({
          ...options,
          loadSessionUsers,
        }),
      createExportMeta: createUserSkillMappingsExportMeta,
    });

    wireExportButton(phonesBtn, {
      title: "Export: Phones",
      loadingStatus: "Loading phones...",
      loadingMessage: 'Fetching "/api/v2/telephony/providers/edges/phones"...',
      countLabel: "phones",
      failureMessage: "Phones export failed",
      loader: getPhones,
      createExportMeta: createPhonesExportMeta,
    });

    wireExportButton(rolesBtn, {
      title: "Export: Roles",
      loadingStatus: "Loading roles...",
      loadingMessage: 'Fetching "/api/v2/authorization/roles"...',
      countLabel: "roles",
      failureMessage: "Roles export failed",
      loader: loadCachedRolesForSession,
      createExportMeta: (resultId, rows, title, status) =>
        createSimpleExportMeta(resultId, rows, title, status, "roles", ["name", "id", "description"]),
    });

    wireExportButton(queuesBtn, {
      title: "Export: Queues",
      loadingStatus: "Loading queues...",
      loadingMessage: 'Fetching "/api/v2/routing/queues"...',
      countLabel: "queues",
      failureMessage: "Queues export failed",
      loader: loadCachedQueuesForSession,
      createExportMeta: (resultId, rows, title, status) =>
        createSimpleExportMeta(resultId, rows, title, status, "queues", ["name", "id", "division.id"]),
    });

    wireExportButton(skillsBtn, {
      title: "Export: Skills",
      loadingStatus: "Loading skills...",
      loadingMessage: 'Fetching "/api/v2/routing/skills"...',
      countLabel: "skills",
      failureMessage: "Skills export failed",
      loader: loadCachedSkillsForSession,
      createExportMeta: (resultId, rows, title, status) =>
        createSimpleExportMeta(resultId, rows, title, status, "skills", ["name", "id", "state"]),
    });

    wireExportButton(groupsBtn, {
      title: "Export: Groups",
      loadingStatus: "Loading groups...",
      loadingMessage: 'Fetching "/api/v2/groups"...',
      countLabel: "groups",
      failureMessage: "Groups export failed",
      loader: loadCachedGroupsForSession,
      createExportMeta: (resultId, rows, title, status) =>
        createSimpleExportMeta(
          resultId,
          rows,
          title,
          status,
          "groups",
          ["name", "id", "memberCount", "type", "visibility", "callsEnabled", "rolesEnabled"]
        ),
    });

    wireExportButton(promptsBtn, {
      title: "Export: Prompts",
      loadingStatus: "Loading prompts...",
      loadingMessage: 'Fetching "/api/v2/architect/prompts"...',
      countLabel: "prompts",
      failureMessage: "Prompts export failed",
      loader: getPrompts,
      createExportMeta: createPromptsExportMeta,
    });

    wireSelectorExportButton(queueMembersBtn, {
      exportKind: "queue-members",
      selectorTitle: "Select Queue",
      selectorLabel: "Queue",
      selectorPlaceholder: "Select Queue",
      selectorLoadingStatus: "Loading queues...",
      selectorLoadingMessage: 'Fetching "/api/v2/routing/queues"...',
      selectorFailureMessage: "Queue selector failed",
      exportTitle: "Export: Queue Members",
      exportLoadingStatus: "Loading queue members...",
      listLoader: loadCachedQueuesForSession,
      mapItems: (queues) =>
        queues
          .slice()
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
          .map((queue) => ({ value: queue.id, label: queue.name || queue.id })),
    });

    wireSelectorExportButton(groupMembersBtn, {
      exportKind: "group-members",
      selectorTitle: "Select Group",
      selectorLabel: "Group",
      selectorPlaceholder: "Select Group",
      selectorLoadingStatus: "Loading groups...",
      selectorLoadingMessage: 'Fetching "/api/v2/groups"...',
      selectorFailureMessage: "Group selector failed",
      exportTitle: "Export: Group Members",
      exportLoadingStatus: "Loading group members...",
      listLoader: loadCachedGroupsForSession,
      mapItems: (groups) =>
        groups
          .slice()
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
          .map((group) => ({ value: group.id, label: group.name || group.id })),
    });

    bulkSkillAssignFeature.wireButton(bulkSkillsBtn, {
      hasConnection: () => state.hasConnection,
    });

    bulkRoleAssignFeature.wireButton(bulkRoleAssignBtn, {
      hasConnection: () => state.hasConnection,
    });

    bulkAutoAnswerFeature.wireButton(bulkAutoAnswerBtn, {
      hasConnection: () => state.hasConnection,
    });

    bulkPasswordResetFeature.wireButton(bulkPasswordResetBtn, {
      hasConnection: () => state.hasConnection,
    });

    bulkLogoffFeature.wireButton(bulkLogoffBtn, {
      hasConnection: () => state.hasConnection,
    });

    bulkDisconnectFeature.wireButton(bulkDisconnectBtn, {
      hasConnection: () => state.hasConnection,
    });

    bulkPriorityUpdateFeature.wireButton(bulkPriorityUpdateBtn, {
      hasConnection: () => state.hasConnection,
    });

    dashboardFeatureRef.wireButton(dashboardBtn, {
      hasConnection: () => state.hasConnection,
    });

    bulkPhoneBuildFeature.wireButton(bulkPhoneBuildBtn, {
      hasConnection: () => state.hasConnection,
    });

    bulkPhoneMoveFeature.wireButton(bulkPhoneMoveBtn, {
      hasConnection: () => state.hasConnection,
    });

    bulkPhoneRemoveFeature.wireButton(bulkPhoneRemoveBtn, {
      hasConnection: () => state.hasConnection,
    });

    bulkPhoneSiteMigrateFeature.wireButton(bulkPhoneSiteMigrateBtn, {
      hasConnection: () => state.hasConnection,
    });

    dataTableExportFeature.wireButton(datatableExportBtn, {
      hasConnection: () => state.hasConnection,
    });

    loadSchedulesFeature.wireButton(loadSchedulesBtn);
    masterAdminFeature.wireButton(createMasterAdminBtn);
    outboundCallSpoofFeature.wireButton(reportCallSpoofBtn);
    inboundCallSpoofFeature.wireButton(inboundCallSpoofBtn);
    intentHealthFeature.wireButton(reportIntentHealthBtn);
    utterancesFeature.wireButton(reportUtterancesBtn);
    userNotificationsFeature.wireButton(userNotificationsBtn);
    queueNotificationsFeature.wireButton(queueNotificationsBtn);
    outboundNotificationsFeature.wireButton(outboundNotificationsBtn);
    notificationMessageParserFeature.wireButton(notificationMessageParserBtn);
    auditLogViewerFeature.wireButton(auditLogViewerBtn);
    mockApiFeature.wireButton(mockApiBtn);

    const getConversationIdForReport = (title) => {
      const credentials = requireCredentials(title);
      if (!credentials) {
        return null;
      }

      const conversationId = reportConversationIdInput ? reportConversationIdInput.value.trim() : "";
      if (!conversationId) {
        prependExportResult(
          title,
          "Conversation ID required",
          '<p class="muted">Enter a conversation ID before running this report.</p>'
        );
        return null;
      }

      return { ...credentials, conversationId };
    };

    flowExecutionFeature.wireButton(reportFlowBtn, () => {
      const request = getConversationIdForReport("Flow Execution");
      return request?.conversationId || "";
    });

    if (reportConversationBtn) {
      reportConversationBtn.addEventListener("click", async () => {
        const request = getConversationIdForReport("Report: Conversation Data");
        if (!request) {
          return;
        }

        const loadingResultId = startExportResult(
          "Report: Conversation Data",
          "Loading conversation...",
          renderLoadingState(`Fetching conversation "${request.conversationId}"...`)
        );

        try {
          const conversation = await getConversation(request);
          finishExportResult(
            loadingResultId,
            "Report: Conversation Data",
            `Loaded ${request.conversationId}`,
            renderJsonBlock(conversation)
          );
        } catch (error) {
          finishExportResult(
            loadingResultId,
            "Report: Conversation Data",
            error.message || "Conversation report failed",
            renderJsonBlock(error.payload || { error: error.message || "Conversation report failed" })
          );
        }
      });
    }

    if (reportAttributesBtn) {
      reportAttributesBtn.addEventListener("click", async () => {
        const request = getConversationIdForReport("Report: Attributes");
        if (!request) {
          return;
        }

        const loadingResultId = startExportResult(
          "Report: Attributes",
          "Loading attributes...",
          renderLoadingState(`Fetching attributes for "${request.conversationId}"...`)
        );

        try {
          const conversation = await getConversation(request);
          const exportMeta = createConversationAttributesExportMeta(
            loadingResultId,
            request.conversationId,
            conversation
          );
          finishExportResult(
            loadingResultId,
            "Report: Attributes",
            exportMeta.status,
            "",
            exportMeta
          );
        } catch (error) {
          finishExportResult(
            loadingResultId,
            "Report: Attributes",
            error.message || "Attributes report failed",
            renderJsonBlock(error.payload || { error: error.message || "Attributes report failed" })
          );
        }
      });
    }

    if (reportInteractionBtn) {
      reportInteractionBtn.addEventListener("click", () => {
        const request = getConversationIdForReport("Report: Interaction Details");
        if (!request) {
          return;
        }

        const appDomain = getCurrentAppDomain();
        if (!appDomain) {
          prependExportResult(
            "Report: Interaction Details",
            "Region required",
            '<p class="muted">Connect to an organization before opening interaction details.</p>'
          );
          return;
        }

        const interactionUrl = `https://apps.${appDomain}/directory/#/analytics/interactions/${encodeURIComponent(request.conversationId)}/admin`;
        window.open(interactionUrl, "_blank", "noopener,noreferrer");
      });
    }

    if (regionSelect) {
      regionSelect.addEventListener("change", async () => {
        const value = getRegionControlValue(regionSelect);
        setRegion(value);
        if (isConnected()) {
          await disconnectOrganization();
          return;
        }
        syncConnectionUi();
      });
    }

    loadGenesysRegions()
      .then(async (regions) => {
        state.regions = Array.isArray(regions) ? regions : [];

        if (regionSelect) {
          const savedRegion = getRegion();
          let savedRegionId = "";

          if (savedRegion) {
            const matchedRegion = state.regions.find(
              (region) => region.id === savedRegion || region.domain === savedRegion
            );

            if (matchedRegion) {
              savedRegionId = matchedRegion.id;
              if (savedRegion !== matchedRegion.id) {
                setRegion(matchedRegion.id);
              }
            }
          }

          try {
            await populateRegionControl(regionSelect, state.regions, savedRegionId);
          } catch (error) {
            console.error("Failed to populate region dropdown:", error);
            showStatus("Failed to populate region list");
          }
        }
      })
      .catch((error) => {
        console.error("Failed to load Genesys regions:", error);
        showStatus("Failed to load regions");
      })
      .finally(async () => {
        syncConnectionUi();

        const oauthError = getOAuthError();
        if (oauthError) {
          clearOAuthError();
          showStatus(oauthError);
          prependExportResult(
            "Connection: Authorization",
            "Authorization failed",
            renderJsonBlock({ error: oauthError })
          );
        }

        if (shouldShowOrgPickerAfterOAuth() && !isConnected()) {
          await resumeOrganizationPickerAfterOAuth();
          return;
        }

        if (shouldAutoConnectAfterOAuth() && !isConnected()) {
          const token = getToken();
          const region = getRegion();
          const intendedOrganization = getOAuthIntendedOrganization();

          clearOAuthAutoConnect();
          clearOAuthIntendedOrganization();

          if (token && region) {
            if (tokenInput) {
              tokenInput.value = token;
            }

            await openDashboardAfterConnect(
              await connectOrganization({
                token,
                region,
                expectedOrganizationId: intendedOrganization.id,
                expectedOrganizationName: intendedOrganization.name,
              })
            );

            if (!isConnected() && intendedOrganization.id) {
              const intendedLabel = intendedOrganization.name || intendedOrganization.id;
              try {
                await presentOrganizationPickerFlow({
                  region,
                  token: getToken(),
                  initialSearch: intendedOrganization.id,
                  statusMessage: `Authorization did not return "${intendedLabel}". Select it again to retry. If Genesys shows access denied, an admin must approve this OAuth client in that organization under Admin → Integrations → Authorized Applications.`,
                });
              } catch (error) {
                showStatus(error.message || "Failed to reopen organization picker.");
              }
            }
          }
        }
      });

    if (isConnected() && getToken()) {
      queueMicrotask(() => {
        dashboardFeatureRef?.openDashboard().catch(() => {});
      });
    }
  };

  return { initializeGenesysApp };
};

const { initializeGenesysApp } = createApp();

export { initializeGenesysApp };
