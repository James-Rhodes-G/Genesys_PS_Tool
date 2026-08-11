import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { executeBulkMutation, executeChunkedBulkMutation, normalizeIds } from "./genesys-bulk.js";
import { downloadFlowExecutionJson } from "./flow-execution-download.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const regionsFilePath = path.resolve(__dirname, "../../public/data/genesys_regions.json");

let genesysRegionsPromise;

const loadGenesysRegions = async () => {
  if (!genesysRegionsPromise) {
    genesysRegionsPromise = readFile(regionsFilePath, "utf8").then((content) => JSON.parse(content));
  }

  return genesysRegionsPromise;
};

const getGenesysDomainForRegion = async (region) => {
  const regions = await loadGenesysRegions();
  const normalizedRegion = String(region || "").trim().toLowerCase();
  const match = regions.find((entry) => {
    const id = String(entry.id || "").trim().toLowerCase();
    const domain = String(entry.domain || "").trim().toLowerCase();

    return id === normalizedRegion || domain === normalizedRegion;
  });

  return match?.domain?.trim() || null;
};

const buildGenesysApiUrl = async (region, path) => {
  const domain = await getGenesysDomainForRegion(region);

  if (!domain) {
    throw new Error(`Unsupported Genesys region: ${region}`);
  }

  return `https://api.${domain}${path}`;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeHeaders = (headers = {}) => {
  const nextHeaders = new Headers(headers);

  if (!nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  return nextHeaders;
};

const getRetryDelayMs = (response, retryAttempt) => {
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterSeconds = Number(retryAfterHeader);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return Math.min(1000 * 2 ** retryAttempt, 10000);
};

const genesysRequest = async ({
  region,
  token,
  path,
  method = "GET",
  headers = {},
  body,
  retries = 3,
}) => {
  if (!token) {
    throw new Error("Genesys token is required");
  }

  const url = await buildGenesysApiUrl(region, path);

  let attempt = 0;
  while (attempt <= retries) {
    const requestHeaders = normalizeHeaders(headers);
    requestHeaders.set("Authorization", `Bearer ${token}`);

    console.log("[genesys] outbound request", { method, region, url, attempt });

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body == null ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (response.status === 429 && attempt < retries) {
      const delayMs = getRetryDelayMs(response, attempt);
      console.warn("[genesys] rate limited, retrying", {
        region,
        url,
        attempt,
        delayMs,
      });
      await wait(delayMs);
      attempt += 1;
      continue;
    }

    if (!response.ok) {
      const message = data?.message || data?.error || `Genesys request failed with ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.details = data;
      throw error;
    }

    console.log("[genesys] outbound response ok", {
      method,
      region,
      url,
      status: response.status,
    });

    return data;
  }

  throw new Error(`Genesys request retries exhausted for ${path}`);
};

const buildPaginatedPath = (path, pageNumber, pageSize) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}pageSize=${pageSize}&pageNumber=${pageNumber}`;
};

const genesysPaginatedRequest = async ({ region, token, path, pageSize = 100 }) => {
  let pageNumber = 1;
  let pageCount = 1;
  const entities = [];

  while (pageNumber <= pageCount) {
    const data = await genesysRequest({
      region,
      token,
      path: buildPaginatedPath(path, pageNumber, pageSize),
    });

    if (Array.isArray(data?.entities)) {
      entities.push(...data.entities);
    }

    pageCount = Number(data?.pageCount || 1);
    pageNumber += 1;
  }

  return entities;
};

const getOrganizationMe = ({ region, token }) =>
  genesysRequest({
    region,
    token,
    path: "/api/v2/organizations/me",
  });

const getOrganizationLimits = ({ region, token }) =>
  genesysRequest({
    region,
    token,
    path: "/api/v2/organizations/limits/docs",
  });

const getTelephonyCallMetrics = ({ region, token }) =>
  genesysRequest({
    region,
    token,
    path: "/api/v2/telephony/calls/metrics",
  });

const getOrgauthorizationTrustors = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/orgauthorization/trustors",
  });

const getOrgauthorizationTrustor = ({ region, token, trustorOrgId }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/orgauthorization/trustors/${encodeURIComponent(trustorOrgId)}`,
  });

const getCurrentUser = ({ region, token }) =>
  genesysRequest({
    region,
    token,
    path: "/api/v2/users/me",
  });

const getUser = ({ region, token, userId }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/users/${encodeURIComponent(userId)}`,
  });

const getUsers = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/users",
  });

const USERS_CACHE_EXPAND =
  "employerInfo,customAttributes,locations,authorization,skills";

const USERS_CACHE_QUERY = `expand=${USERS_CACHE_EXPAND}&sortOrder=ascending&state=any`;

const getUsersExpanded = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: `/api/v2/users?${USERS_CACHE_QUERY}`,
  });

const leanUserForCache = (user) => {
  if (!user || typeof user !== "object") {
    return user;
  }

  const next = { ...user };

  if (user.authorization && typeof user.authorization === "object") {
    next.authorization = {
      roles: Array.isArray(user.authorization.roles) ? user.authorization.roles : [],
    };

    if (Array.isArray(user.authorization.unusedRoles)) {
      next.authorization.unusedRoles = user.authorization.unusedRoles;
    }
  }

  return next;
};

const paginateUsersExpanded = async ({ region, token, pageSize = 100, onPage }) => {
  const path = `/api/v2/users?${USERS_CACHE_QUERY}`;
  let pageNumber = 1;
  let pageCount = 1;
  const users = [];

  while (pageNumber <= pageCount) {
    const data = await genesysRequest({
      region,
      token,
      path: buildPaginatedPath(path, pageNumber, pageSize),
    });

    const entities = Array.isArray(data?.entities)
      ? data.entities.map(leanUserForCache)
      : [];
    users.push(...entities);
    pageCount = Number(data?.pageCount || 1);

    if (typeof onPage === "function") {
      await onPage({
        entities,
        pageNumber,
        pageCount,
        syncedCount: users.length,
        total: Number(data?.total || users.length),
      });
    }

    pageNumber += 1;
  }

  return users;
};

const getPhones = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/telephony/providers/edges/phones?expand=site,phoneBaseSettings,lines&fields=webRtcUser,properties.*,lines.loggedInUser,lines.defaultForUser",
  });

const getRoles = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/authorization/roles",
  });

const getAuthorizationPermissions = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/authorization/permissions",
  });

const MASTER_ADMIN_GENERAL_PERMISSIONS = [
  "location_contributor",
  "user_manager",
  "notification_administration",
  "integration_config_administration",
  "group_administration",
  "admin",
  "employee",
  "content_management_admin",
  "location_administration",
  "person_administration",
  "architect_administration",
  "content_management_user",
  "architect_read_only",
  "group_creation",
  "field_administration",
  "user_administration",
  "location_manager",
  "architect_editor",
  "notification_creation",
  "role_manager",
];

const buildMasterAdminPermissionPolicies = (permissions) =>
  (Array.isArray(permissions) ? permissions : []).reduce((policies, permission) => {
    const domain = String(permission?.domain || "").trim();
    if (!domain) {
      return policies;
    }

    policies.push({
      domain,
      entityName: "*",
      actionSet: ["*"],
      allowConditions: false,
    });
    return policies;
  }, []);

const createMasterAdminRole = async ({
  region,
  token,
  roleName = "Full Master Admin",
  description = "This contains every domains ALL PERMISSIONS permission",
}) => {
  const normalizedRoleName = String(roleName || "").trim();
  const normalizedDescription = String(description || "").trim();

  if (!normalizedRoleName) {
    throw new Error("roleName is required");
  }

  const permissions = await getAuthorizationPermissions({ region, token });
  const permissionPolicies = buildMasterAdminPermissionPolicies(permissions);

  const createdRole = await genesysRequest({
    region,
    token,
    method: "POST",
    path: "/api/v2/authorization/roles",
    body: {
      name: normalizedRoleName,
      description: normalizedDescription,
      permissions: MASTER_ADMIN_GENERAL_PERMISSIONS,
      permissionPolicies,
    },
  });

  return {
    roleId: createdRole?.id || "",
    roleName: createdRole?.name || normalizedRoleName,
    description: createdRole?.description || normalizedDescription,
    generalPermissionCount: MASTER_ADMIN_GENERAL_PERMISSIONS.length,
    permissionPolicyCount: permissionPolicies.length,
  };
};

const loadSchedules = async ({ region, token, schedules }) => {
  const scheduleEntries = Array.isArray(schedules) ? schedules : [];
  const scheduleMap = new Map(
    scheduleEntries
      .filter((schedule) => schedule?.scheduleKey)
      .map((schedule) => [String(schedule.scheduleKey), schedule])
  );

  return executeBulkMutation({
    ids: scheduleEntries.map((schedule) => schedule?.scheduleKey),
    executeItem: async (scheduleKey) => {
      const schedule = scheduleMap.get(scheduleKey);
      if (!schedule) {
        throw new Error("Schedule definition not found");
      }

      const {
        scheduleKey: _scheduleKey,
        countryCode,
        sourceName,
        requestedName,
        ...payload
      } = schedule;

      const createdSchedule = await genesysRequest({
        region,
        token,
        method: "POST",
        path: "/api/v2/architect/schedules",
        body: payload,
      });

      return {
        countryCode: countryCode || "",
        sourceName: sourceName || "",
        requestedName: requestedName || payload.name || "",
        scheduleId: createdSchedule?.id || "",
        scheduleName: createdSchedule?.name || payload.name || "",
      };
    },
  }).then((results) =>
    results.map((result) => {
      const sourceSchedule = scheduleMap.get(result.id) || {};
      return {
        scheduleKey: result.id,
        countryCode: result.response?.countryCode || sourceSchedule.countryCode || "",
        sourceName: result.response?.sourceName || sourceSchedule.sourceName || "",
        requestedName:
          result.response?.requestedName || sourceSchedule.requestedName || sourceSchedule.name || "",
        scheduleId: result.response?.scheduleId || "",
        scheduleName: result.response?.scheduleName || "",
        status: result.status,
        error: result.error || "",
        details: result.details || null,
      };
    })
  );
};

const getDivisions = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/authorization/divisions?pageSize=100&sortBy=name&sortOrder=ASC",
  });

const getQueues = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/routing/queues",
  });

const getQueueMembers = ({ region, token, queueId }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: `/api/v2/routing/queues/${queueId}/members?expand=skills`,
  });

const getSkills = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/routing/skills?sortBy=name&sortOrder=asc",
  });

const getGroups = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/groups?sortOrder=ascending",
  });

const getGroupMembers = ({ region, token, groupId }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: `/api/v2/groups/${groupId}/individuals`,
  });

const getPrompts = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/architect/prompts?sortBy=name&sortOrder=asc",
  });

const getUserRoutingSkills = ({ region, token, userId }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/users/${userId}/routingskills`,
  });

const getAuthorizationSubject = ({ region, token, subjectId }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/authorization/subjects/${encodeURIComponent(subjectId)}`,
  });

const getUsersWithSkills = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/users?expand=skills&sortOrder=ascending",
  });

const normalizeRoutingSkills = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.entities)) {
    return payload.entities;
  }

  return [];
};

const formatUserSkillAssignments = (skills) => {
  const normalizedSkills = normalizeRoutingSkills(skills);

  if (normalizedSkills.length === 0) {
    return "";
  }

  return normalizedSkills
    .map((skill) => {
      const skillName = skill?.name || skill?.id || "";
      const proficiency = skill?.proficiency ?? "";
      return skillName ? `${skillName}:${proficiency}` : "";
    })
    .filter(Boolean)
    .join(" | ");
};

const getUserSkillMappings = async ({ region, token }) => {
  const users = await getUsers({ region, token });
  const results = await executeBulkMutation({
    ids: users.map((user) => user.id),
    executeItem: (userId) => getUserRoutingSkills({ region, token, userId }),
  });

  return results.map((result) => {
    const user = users.find((entry) => entry.id === result.id);
    const base = {
      name: user?.name || "",
      userName: user?.username || user?.userName || "",
      userId: result.id,
    };

    if (result.status !== "success") {
      return {
        ...base,
        skillAssignments: "",
        status: result.status,
        error: result.error || "",
      };
    }

    const skills = normalizeRoutingSkills(result.response);
    return {
      ...base,
      skillAssignments: formatUserSkillAssignments(skills),
      status: "success",
      error: "",
    };
  });
};

const formatUserRoleAssignments = (grants) => {
  if (!Array.isArray(grants) || grants.length === 0) {
    return "";
  }

  return grants
    .map((grant) => {
      const roleName = grant?.role?.name || grant?.role?.id || "";
      const divisionName = grant?.division?.name || "All";
      return roleName ? `${roleName}:${divisionName}` : "";
    })
    .filter(Boolean)
    .join(" | ");
};

const buildUserRoleMappingRow = (user, result) => {
  const base = {
    name: user?.name || "",
    userName: user?.username || user?.userName || "",
    userId: user?.id || result?.id || "",
  };

  if (result?.status !== "success") {
    return {
      ...base,
      roleAssignments: "",
      status: result?.status || "failed",
      error: result?.error || "",
    };
  }

  const grants = Array.isArray(result.response?.grants) ? result.response.grants : [];
  return {
    ...base,
    roleAssignments: formatUserRoleAssignments(grants),
    status: "success",
    error: "",
  };
};

const getUserRoleMappings = async ({ region, token }) => {
  const users = await getUsers({ region, token });
  const userById = new Map(users.map((user) => [user.id, user]));
  const results = await executeBulkMutation({
    ids: users.map((user) => user.id),
    executeItem: (userId) => getAuthorizationSubject({ region, token, subjectId: userId }),
  });

  return results.map((result) => buildUserRoleMappingRow(userById.get(result.id), result));
};

const addUserRoutingSkill = ({ region, token, userId, skill }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/users/${userId}/routingskills`,
    method: "POST",
    body: skill,
  });

const assignRoutingSkillsToUsers = async ({ region, token, userIds, skills }) => {
  const normalizedUserIds = normalizeIds(userIds);
  const normalizedSkills = Array.isArray(skills)
    ? skills
        .map((skill) => ({
          id: String(skill?.id || "").trim(),
          proficiency: Number(skill?.proficiency),
        }))
        .filter((skill) => skill.id && Number.isFinite(skill.proficiency))
    : [];

  return executeBulkMutation({
    ids: normalizedUserIds,
    executeItem: async (userId) =>
      genesysRequest({
        region,
        token,
        method: "PATCH",
        path: `/api/v2/users/${encodeURIComponent(userId)}/routingskills/bulk`,
        body: normalizedSkills,
      }),
  }).then((results) =>
    results.map((result) => ({
      ...result,
      userId: result.id,
    }))
  );
};

const getPhone = ({ region, token, phoneId }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/telephony/providers/edges/phones/${phoneId}`,
  });

const getPasswordPolicy = ({ region, token }) =>
  genesysRequest({
    region,
    token,
    path: "/api/v2/organizations/authentication/settings",
  });

const logoffUsers = ({ region, token, userIds }) =>
  executeBulkMutation({
    ids: userIds,
    executeItem: async (userId) => {
      await genesysRequest({
        region,
        token,
        path: `/api/v2/apps/users/${userId}/logout`,
        method: "DELETE",
      });

      return { userId };
    },
  }).then((results) =>
    results.map((result) => ({
      userId: result.id,
      status: result.status,
      error: result.error || "",
      details: result.details || null,
    }))
  );

const sanitizePhoneTemplateForCreate = (templatePhone, user) => {
  const clone = JSON.parse(JSON.stringify(templatePhone || {}));

  [
    "id",
    "selfUri",
    "state",
    "status",
    "dateCreated",
    "dateModified",
    "version",
    "webRtcUser",
    "loggedInUser",
  ].forEach((key) => {
    delete clone[key];
  });

  if (clone.site?.id) {
    clone.site = { id: clone.site.id };
  }

  if (clone.phoneBaseSettings?.id) {
    clone.phoneBaseSettings = { id: clone.phoneBaseSettings.id };
  }

  if (Array.isArray(clone.lines)) {
    clone.lines = clone.lines.map((line) => {
      const nextLine = JSON.parse(JSON.stringify(line || {}));

      [
        "id",
        "selfUri",
        "loggedInUser",
        "state",
        "status",
        "dateCreated",
        "dateModified",
        "version",
      ].forEach((key) => {
        delete nextLine[key];
      });

      if (nextLine.lineBaseSettings?.id) {
        nextLine.lineBaseSettings = { id: nextLine.lineBaseSettings.id };
      }

      return nextLine;
    });
  }

  const baseName = String(user?.name || user?.userName || user?.id || "user")
    .trim()
    .replace(/\s+/g, "_");

  clone.name = `${baseName}_webRTC`;
  clone.webRtcUser = { id: user.id };

  return clone;
};

const buildPhones = async ({ region, token, users, templatePhoneId }) => {
  const templatePhone = await getPhone({ region, token, phoneId: templatePhoneId });

  return executeBulkMutation({
    ids: users.map((user) => user?.id),
    executeItem: async (userId) => {
      const user = users.find((entry) => String(entry?.id) === String(userId));
      if (!user?.id) {
        throw new Error("User is required for phone build");
      }

      const payload = sanitizePhoneTemplateForCreate(templatePhone, user);
      const createdPhone = await genesysRequest({
        region,
        token,
        path: "/api/v2/telephony/providers/edges/phones",
        method: "POST",
        body: payload,
      });

      return {
        phoneId: createdPhone?.id || "",
        phoneName: createdPhone?.name || payload.name || "",
      };
    },
  }).then((results) =>
    results.map((result) => ({
      userId: result.id,
      status: result.status,
      error: result.error || "",
      phoneId: result.response?.phoneId || "",
      phoneName: result.response?.phoneName || "",
      details: result.details || null,
    }))
  );
};

const getSites = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/telephony/providers/edges/sites",
  });

const sanitizePhoneForUpdate = (phone) => {
  const clone = JSON.parse(JSON.stringify(phone || {}));

  [
    "id",
    "selfUri",
    "dateCreated",
    "dateModified",
    "createdBy",
    "modifiedBy",
    "status",
    "state",
    "version",
    "primaryEdge",
  ].forEach((key) => {
    delete clone[key];
  });

  if (clone.site?.id) {
    clone.site = { id: clone.site.id };
  }

  if (clone.phoneBaseSettings?.id) {
    clone.phoneBaseSettings = { id: clone.phoneBaseSettings.id };
  }

  if (Array.isArray(clone.lines)) {
    clone.lines = clone.lines.map((line) => {
      const nextLine = JSON.parse(JSON.stringify(line || {}));

      ["id", "selfUri", "loggedInUser", "state", "status", "dateCreated", "dateModified", "version"].forEach((key) => {
        delete nextLine[key];
      });

      if (nextLine.lineBaseSettings?.id) {
        nextLine.lineBaseSettings = { id: nextLine.lineBaseSettings.id };
      }

      return nextLine;
    });
  }

  return clone;
};

const updatePhone = async ({ region, token, phoneId, phoneBody }) =>
  genesysRequest({
    region,
    token,
    method: "PUT",
    path: `/api/v2/telephony/providers/edges/phones/${encodeURIComponent(phoneId)}`,
    body: phoneBody,
  });

const movePhoneToSite = async ({ region, token, phoneId, siteId }) => {
  const phone = await getPhone({ region, token, phoneId });
  const body = sanitizePhoneForUpdate(phone);
  body.site = { id: siteId };

  const updatedPhone = await updatePhone({ region, token, phoneId, phoneBody: body });

  return {
    phoneId,
    phoneName: updatedPhone?.name || phone?.name || phoneId,
    siteId,
  };
};

const deletePhoneById = ({ region, token, phoneId }) =>
  genesysRequest({
    region,
    token,
    method: "DELETE",
    path: `/api/v2/telephony/providers/edges/phones/${encodeURIComponent(phoneId)}`,
  });

const movePhonesToSite = async ({ region, token, phoneIds, siteId }) => {
  const normalizedSiteId = String(siteId || "").trim();
  if (!normalizedSiteId) {
    throw new Error("siteId is required.");
  }

  return executeBulkMutation({
    ids: phoneIds,
    executeItem: async (phoneId) => movePhoneToSite({ region, token, phoneId, siteId: normalizedSiteId }),
  }).then((results) =>
    results.map((result) => ({
      phoneId: result.id,
      status: result.status,
      error: result.error || "",
      phoneName: result.response?.phoneName || "",
      siteId: result.response?.siteId || normalizedSiteId,
      details: result.details || null,
    }))
  );
};

const deletePhones = async ({ region, token, phoneIds }) =>
  executeBulkMutation({
    ids: phoneIds,
    executeItem: async (phoneId) => {
      const phone = await getPhone({ region, token, phoneId }).catch(() => null);
      await deletePhoneById({ region, token, phoneId });

      return {
        phoneId,
        phoneName: phone?.name || phoneId,
      };
    },
  }).then((results) =>
    results.map((result) => ({
      phoneId: result.id,
      status: result.status,
      error: result.error || "",
      phoneName: result.response?.phoneName || "",
      details: result.details || null,
    }))
  );

const getDataTables = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/flows/datatables?showbrief=false",
  });

const getDataTableRows = ({ region, token, tableId }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: `/api/v2/flows/datatables/${encodeURIComponent(tableId)}/rows`,
  });

const flattenDataTableRow = (row) => {
  if (!row || typeof row !== "object") {
    return { value: row };
  }

  if (row.values && typeof row.values === "object") {
    return {
      key: row.key ?? "",
      ...row.values,
    };
  }

  return row;
};

const exportDataTables = async ({ region, token, tableIds }) => {
  const normalizedTableIds = Array.isArray(tableIds)
    ? tableIds.map((tableId) => String(tableId || "").trim()).filter(Boolean)
    : [];

  if (!normalizedTableIds.length) {
    throw new Error("At least one data table id is required.");
  }

  const tables = await getDataTables({ region, token });
  const tableById = new Map((tables || []).map((table) => [String(table.id), table]));
  const exports = [];

  for (const tableId of normalizedTableIds) {
    try {
      const tableMeta = tableById.get(tableId) || { id: tableId, name: tableId };
      const rows = await getDataTableRows({ region, token, tableId });
      exports.push({
        tableId,
        tableName: tableMeta.name || tableId,
        status: "success",
        rowCount: rows.length,
        rows: rows.map((row) => ({
          tableId,
          tableName: tableMeta.name || tableId,
          ...flattenDataTableRow(row),
        })),
      });
    } catch (error) {
      exports.push({
        tableId,
        tableName: tableById.get(tableId)?.name || tableId,
        status: "failed",
        rowCount: 0,
        rows: [],
        error: error.message,
      });
    }
  }

  return exports;
};

const updateConversationPriority = ({ region, token, conversationId, priority }) =>
  genesysRequest({
    region,
    token,
    method: "PATCH",
    path: `/api/v2/routing/conversations/${encodeURIComponent(conversationId)}`,
    body: { priority },
  });

const updateConversationPriorities = async ({ region, token, updates }) => {
  const normalizedUpdates = Array.isArray(updates)
    ? updates
        .map((entry) => ({
          conversationId: String(entry?.conversationId || "").trim(),
          priority: Number(entry?.priority),
        }))
        .filter((entry) => entry.conversationId && Number.isFinite(entry.priority))
    : [];

  if (!normalizedUpdates.length) {
    throw new Error("updates must include conversationId and priority.");
  }

  return executeBulkMutation({
    ids: normalizedUpdates.map((entry) => entry.conversationId),
    executeItem: async (conversationId) => {
      const update = normalizedUpdates.find((entry) => entry.conversationId === conversationId);
      await updateConversationPriority({
        region,
        token,
        conversationId,
        priority: update.priority,
      });

      return {
        conversationId,
        priority: update.priority,
      };
    },
  }).then((results) =>
    results.map((result) => ({
      conversationId: result.id,
      status: result.status,
      error: result.error || "",
      priority: result.response?.priority ?? "",
      details: result.details || null,
    }))
  );
};

const setUsersAutoAnswer = async ({ region, token, userIds, acdAutoAnswer }) =>
  executeChunkedBulkMutation({
    ids: userIds,
    chunkSize: 50,
    executeChunk: async (chunk) =>
      genesysRequest({
        region,
        token,
        method: "PATCH",
        path: "/api/v2/users/bulk",
        body: chunk.map((id) => ({ id, acdAutoAnswer })),
      }),
    buildSuccessRow: ({ id, response }) => {
      const entities = Array.isArray(response?.entities) ? response.entities : Array.isArray(response) ? response : [];
      const returnedIds = new Set(entities.map((entity) => String(entity?.id || "").trim()).filter(Boolean));
      const entity = entities.find((candidate) => String(candidate?.id || "").trim() === id);
      return {
        id,
        status: returnedIds.has(id) ? "success" : "unknown",
        acdAutoAnswer,
        response: entity || null,
      };
    },
    buildFailureRow: ({ id, error }) => ({
      id,
      status: "failed",
      acdAutoAnswer,
      error: error.message,
      details: error.details || null,
    }),
  });

const resetUsersPasswords = async ({ region, token, passwordResets }) => {
  const normalizedResets = Array.isArray(passwordResets)
    ? passwordResets
        .map((entry) => ({
          userId: String(entry?.userId || "").trim(),
          newPassword: String(entry?.newPassword || ""),
        }))
        .filter((entry) => entry.userId && entry.newPassword)
    : [];

  return executeBulkMutation({
    ids: normalizedResets.map((entry) => entry.userId),
    executeItem: async (userId) => {
      const reset = normalizedResets.find((entry) => entry.userId === userId);
      return genesysRequest({
        region,
        token,
        method: "POST",
        path: `/api/v2/users/${encodeURIComponent(userId)}/password`,
        body: {
          newPassword: reset?.newPassword || "",
        },
      });
    },
  }).then((results) =>
    results.map((result) => ({
      ...result,
      userId: result.id,
    }))
  );
};

const assignUsersToRoleDivision = async ({ region, token, userIds, roleId, divisionId, chunkSize = 100 }) =>
  executeChunkedBulkMutation({
    ids: userIds,
    chunkSize,
    executeChunk: async (subjectIds) =>
      genesysRequest({
        region,
        token,
        method: "POST",
        path: `/api/v2/authorization/roles/${encodeURIComponent(roleId)}`,
        body: {
          divisionIds: [divisionId],
          subjectIds,
        },
      }),
    buildSuccessRow: ({ id, response }) => ({
      userId: id,
      roleId,
      divisionId,
      status: "success",
      response: response || null,
    }),
    buildFailureRow: ({ id, error }) => ({
      userId: id,
      roleId,
      divisionId,
      status: "failed",
      error: error.message,
      details: error.details || null,
    }),
  });

const MEDIA_TYPE_VALUES = ["voice", "chat", "email", "message", "callback"];
const INTERACTION_SCOPE_VALUES = ["all-open", "waiting", "agent"];

const buildOpenInteractionsQueryBody = ({
  queueId,
  lookbackDays = 7,
  scope = "all-open",
  mediaTypes = [],
  pageNumber = 1,
  pageSize = 100,
}) => {
  const normalizedQueueId = String(queueId || "").trim();
  if (!normalizedQueueId) {
    throw new Error("queueId is required.");
  }

  const normalizedScope = INTERACTION_SCOPE_VALUES.includes(scope) ? scope : "all-open";
  const normalizedLookbackDays = Math.max(1, Math.min(Number(lookbackDays) || 7, 30));
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - normalizedLookbackDays);

  const segmentPredicates = [
    {
      type: "dimension",
      dimension: "queueId",
      operator: "matches",
      value: normalizedQueueId,
    },
  ];

  if (normalizedScope === "waiting") {
    segmentPredicates.push(
      {
        type: "dimension",
        dimension: "purpose",
        operator: "matches",
        value: "acd",
      },
      {
        type: "dimension",
        dimension: "segmentEnd",
        operator: "notExists",
        value: null,
      }
    );
  } else if (normalizedScope === "agent") {
    segmentPredicates.push(
      {
        type: "dimension",
        dimension: "purpose",
        operator: "matches",
        value: "agent",
      },
      {
        type: "dimension",
        dimension: "segmentEnd",
        operator: "notExists",
        value: null,
      }
    );
  }

  const normalizedMediaTypes = (Array.isArray(mediaTypes) ? mediaTypes : [])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter((value) => MEDIA_TYPE_VALUES.includes(value));

  const segmentFilters = [
    {
      type: "and",
      predicates: segmentPredicates,
    },
  ];

  if (normalizedMediaTypes.length === 1) {
    segmentFilters[0].predicates.push({
      type: "dimension",
      dimension: "mediaType",
      operator: "matches",
      value: normalizedMediaTypes[0],
    });
  } else if (normalizedMediaTypes.length > 1) {
    segmentFilters.push({
      type: "or",
      predicates: normalizedMediaTypes.map((value) => ({
        type: "dimension",
        dimension: "mediaType",
        operator: "matches",
        value,
      })),
    });
  }

  return {
    interval: `${start.toISOString()}/${end.toISOString()}`,
    order: "asc",
    orderBy: "conversationStart",
    paging: {
      pageSize,
      pageNumber,
    },
    segmentFilters,
    conversationFilters: [
      {
        type: "and",
        predicates: [
          {
            type: "dimension",
            dimension: "conversationEnd",
            operator: "notExists",
            value: null,
          },
        ],
      },
    ],
  };
};

const pickActiveQueueSegment = (segments, queueId) => {
  if (!Array.isArray(segments)) {
    return null;
  }

  const openSegments = segments.filter((segment) => !segment?.segmentEnd);
  const queueMatches = openSegments.filter((segment) => !queueId || segment?.queueId === queueId);
  return queueMatches[0] || openSegments[0] || null;
};

const normalizeOpenInteractionRow = (conversation, queueId) => {
  const conversationId = String(conversation?.conversationId || conversation?.id || "").trim();
  const startTime = conversation?.conversationStart || "";
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : [];

  let mediaType = "";
  let direction = "";
  let ani = "";
  let dnis = "";
  let purpose = "";
  let agentName = "";

  participants.forEach((participant) => {
    if (participant?.purpose === "agent") {
      agentName = participant?.participantName || participant?.userId || agentName;
    }

    const sessions = Array.isArray(participant?.sessions) ? participant.sessions : [];
    sessions.forEach((session) => {
      mediaType = mediaType || session?.mediaType || "";
      direction = direction || session?.direction || "";
      ani = ani || session?.ani || "";
      dnis = dnis || session?.dnis || "";

      const activeSegment = pickActiveQueueSegment(session?.segments, queueId);
      if (activeSegment?.purpose) {
        purpose = activeSegment.purpose;
      }
    });
  });

  return {
    conversationId,
    startTime,
    mediaType,
    direction,
    ani,
    dnis,
    purpose,
    agentName,
  };
};

const queryOpenQueueInteractions = async ({
  region,
  token,
  queueId,
  lookbackDays = 7,
  scope = "all-open",
  mediaTypes = [],
  minDurationMinutes = 0,
}) => {
  const normalizedQueueId = String(queueId || "").trim();
  if (!normalizedQueueId) {
    throw new Error("queueId is required.");
  }

  const minDurationMs = Math.max(0, Number(minDurationMinutes) || 0) * 60 * 1000;
  const pageSize = 100;
  let pageNumber = 1;
  let pageCount = 1;
  const conversationsById = new Map();

  while (pageNumber <= pageCount) {
    const body = buildOpenInteractionsQueryBody({
      queueId: normalizedQueueId,
      lookbackDays,
      scope,
      mediaTypes,
      pageNumber,
      pageSize,
    });

    const data = await genesysRequest({
      region,
      token,
      method: "POST",
      path: "/api/v2/analytics/conversations/details/query",
      body,
    });

    pageCount = Number(data?.pageCount || 1);
    const entities = Array.isArray(data?.conversations) ? data.conversations : [];

    entities.forEach((conversation) => {
      const row = normalizeOpenInteractionRow(conversation, normalizedQueueId);
      if (!row.conversationId) {
        return;
      }

      if (minDurationMs > 0) {
        const startedAt = Date.parse(row.startTime);
        if (!Number.isFinite(startedAt) || Date.now() - startedAt < minDurationMs) {
          return;
        }
      }

      conversationsById.set(row.conversationId, row);
    });

    pageNumber += 1;
  }

  return Array.from(conversationsById.values()).sort((left, right) => {
    const leftStart = Date.parse(left.startTime || "");
    const rightStart = Date.parse(right.startTime || "");
    if (Number.isFinite(leftStart) && Number.isFinite(rightStart) && leftStart !== rightStart) {
      return leftStart - rightStart;
    }

    return String(left.conversationId).localeCompare(String(right.conversationId));
  });
};

const disconnectConversations = async ({ region, token, conversationIds }) =>
  executeBulkMutation({
    ids: conversationIds,
    executeItem: async (conversationId) =>
      genesysRequest({
        region,
        token,
        method: "POST",
        path: `/api/v2/conversations/${encodeURIComponent(conversationId)}/disconnect`,
        body: {},
      }),
  });

const getConversation = ({ region, token, conversationId }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/conversations/${encodeURIComponent(conversationId)}`,
  });

const getFlowExecutions = ({ region, token, conversationId }) =>
  genesysRequest({
    region,
    token,
    method: "POST",
    path: "/api/v2/flows/instances/query?pageSize=200",
    body: {
      query: [
        {
          criteria: {
            key: "ConversationId",
            operator: "eq",
            value: conversationId,
          },
        },
      ],
    },
  }).then((data) => data?.entities || []);

const downloadFlowExecution = (options) => downloadFlowExecutionJson(options);

const spoofOutboundCall = async ({ region, token, phoneNumber, callerId, callerIdName }) => {
  const normalizedPhoneNumber = String(phoneNumber || "").trim();
  if (!normalizedPhoneNumber) {
    throw new Error("phoneNumber is required");
  }

  const createdCall = await genesysRequest({
    region,
    token,
    method: "POST",
    path: "/api/v2/conversations/calls",
    body: {
      phoneNumber: normalizedPhoneNumber,
      callerId: String(callerId || "").trim(),
      callerIdName: String(callerIdName || "").trim(),
    },
  });

  return {
    conversationId: createdCall?.id || createdCall?.conversationId || "",
    phoneNumber: normalizedPhoneNumber,
    callerId: String(callerId || "").trim(),
    callerIdName: String(callerIdName || "").trim(),
    raw: createdCall,
  };
};

const spoofInboundCall = async ({
  region,
  token,
  callUserId,
  inboundDnis,
  callerId,
  callerIdName,
  uuiData,
  callDateTime,
  callTimeZone,
  description,
  customAttributes,
}) => {
  const normalizedInboundDnis = String(inboundDnis || "").trim();
  if (!normalizedInboundDnis) {
    throw new Error("inboundDnis is required");
  }

  let userId = String(callUserId || "").trim();
  if (!userId) {
    const currentUser = await getCurrentUser({ region, token });
    userId = currentUser?.id || "";
  }

  if (!userId) {
    throw new Error("Unable to resolve current user for call spoof");
  }

  const attributes = {
    DNIS: normalizedInboundDnis,
  };

  if (callDateTime) {
    attributes.CallDateTime = String(callDateTime);
  }
  if (callTimeZone) {
    attributes.CallTimeZone = String(callTimeZone);
  }
  if (description) {
    attributes.Description = String(description);
  }

  if (customAttributes && typeof customAttributes === "object") {
    Object.entries(customAttributes).forEach(([key, value]) => {
      const attributeKey = String(key || "").trim();
      if (attributeKey) {
        attributes[attributeKey] = String(value ?? "");
      }
    });
  }

  const body = {
    callUserId: userId,
    callerId: String(callerId || "").trim(),
    callerIdName: String(callerIdName || "").trim(),
    attributes,
  };

  if (uuiData) {
    body.uuiData = String(uuiData);
  }

  const createdCall = await genesysRequest({
    region,
    token,
    method: "POST",
    path: "/api/v2/conversations/calls",
    body,
  });

  return {
    conversationId: createdCall?.id || createdCall?.conversationId || "",
    callUserId: userId,
    inboundDnis: normalizedInboundDnis,
    callerId: body.callerId,
    callerIdName: body.callerIdName,
    uuiData: body.uuiData || "",
    callDateTime: attributes.CallDateTime || "",
    callTimeZone: attributes.CallTimeZone || "",
    description: attributes.Description || "",
    attributes,
    raw: createdCall,
  };
};

const getBotFlows = ({ region, token }) =>
  genesysPaginatedRequest({
    region,
    token,
    path: "/api/v2/flows?type=bot,digitalbot",
    pageSize: 99,
  });

const buildBotUtterancesPath = (flowId, filters = {}) => {
  const params = new URLSearchParams({ pageSize: "250" });

  if (filters.sessionId) {
    params.set("sessionId", String(filters.sessionId));
  }
  if (filters.askActionId) {
    params.set("askActionId", String(filters.askActionId));
  }
  if (filters.askActionResults) {
    params.set("askActionResults", String(filters.askActionResults));
  }
  if (filters.pageNumber) {
    params.set("pageNumber", String(filters.pageNumber));
  }

  return `/api/v2/analytics/botflows/${encodeURIComponent(flowId)}/divisions/reportingturns?${params}`;
};

const getBotUtterances = ({ region, token, flowId, filters = {} }) =>
  genesysRequest({
    region,
    token,
    path: buildBotUtterancesPath(flowId, filters),
  });

const getIntentHealth = ({ region, token, flowId, versionId }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/flows/${encodeURIComponent(flowId)}/versions/${encodeURIComponent(versionId)}/health?pageSize=1`,
  });

const getAuditServiceMapping = ({ region, token }) =>
  genesysRequest({
    region,
    token,
    path: "/api/v2/audits/query/servicemapping",
  });

const createAuditQuery = ({ region, token, query }) =>
  genesysRequest({
    region,
    token,
    path: "/api/v2/audits/query",
    method: "POST",
    body: query,
  });

const getAuditQueryStatus = ({ region, token, transactionId }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/audits/query/${encodeURIComponent(transactionId)}`,
  });

const getAuditQueryResults = ({ region, token, transactionId, cursor = "" }) => {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }

  const query = params.toString();
  const path = `/api/v2/audits/query/${encodeURIComponent(transactionId)}/results${query ? `?${query}` : ""}`;

  return genesysRequest({
    region,
    token,
    path,
  });
};

const createNotificationChannel = ({ region, token }) =>
  genesysRequest({
    region,
    token,
    path: "/api/v2/notifications/channels",
    method: "POST",
  });

const subscribeNotificationTopics = ({ region, token, channelId, topics }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/notifications/channels/${encodeURIComponent(channelId)}/subscriptions`,
    method: "POST",
    body: (topics || []).map((topicId) => ({ id: topicId })),
  });

const deleteNotificationChannel = ({ region, token, channelId }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/notifications/channels/${encodeURIComponent(channelId)}`,
    method: "DELETE",
  });

const getAvailableNotificationTopics = ({ region, token }) =>
  genesysRequest({
    region,
    token,
    path: "/api/v2/notifications/availabletopics",
  });

export {
  assignRoutingSkillsToUsers,
  assignUsersToRoleDivision,
  buildGenesysApiUrl,
  buildPhones,
  createMasterAdminRole,
  genesysRequest,
  genesysPaginatedRequest,
  getAuthorizationPermissions,
  getAvailableNotificationTopics,
  getBotFlows,
  getBotUtterances,
  getConversation,
  getCurrentUser,
  downloadFlowExecution,
  getFlowExecutions,
  getGroups,
  getGroupMembers,
  getIntentHealth,
  getOrganizationMe,
  getOrganizationLimits,
  getOrgauthorizationTrustor,
  getOrgauthorizationTrustors,
  getAuthorizationSubject,
  getAuditQueryResults,
  getAuditQueryStatus,
  getAuditServiceMapping,
  createAuditQuery,
  createNotificationChannel,
  deleteNotificationChannel,
  deletePhones,
  disconnectConversations,
  exportDataTables,
  getDataTables,
  getDataTableRows,
  getSites,
  movePhonesToSite,
  queryOpenQueueInteractions,
  updateConversationPriorities,
  getUserRoutingSkills,
  getUserRoleMappings,
  getUserSkillMappings,
  getUsersWithSkills,
  getPrompts,
  getQueueMembers,
  getQueues,
  getRoles,
  getSkills,
  getUsers,
  getUsersExpanded,
  leanUserForCache,
  paginateUsersExpanded,
  USERS_CACHE_EXPAND,
  getPhones,
  getPhone,
  getPasswordPolicy,
  getGenesysDomainForRegion,
  getDivisions,
  getUser,
  addUserRoutingSkill,
  logoffUsers,
  loadSchedules,
  resetUsersPasswords,
  setUsersAutoAnswer,
  spoofInboundCall,
  spoofOutboundCall,
  subscribeNotificationTopics,
  getTelephonyCallMetrics,
};
