import { ensureSessionUsersSynced, fetchCachedUsers, loadSessionUsers } from "./session-store.js";
import { isVaultMode } from "./genesys-auth.js";

const withGenesysFetchOptions = (options = {}) => {
  const init = {
    credentials: "include",
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  };

  if (isVaultMode()) {
    delete init.headers["x-genesys-region"];
    delete init.headers["x-genesys-token"];
  }

  return init;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (response) => {
  const header = response.headers.get("retry-after");
  if (!header) {
    return null;
  }

  const trimmed = String(header).trim();
  if (!trimmed) {
    return null;
  }

  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const asDate = Date.parse(trimmed);
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return null;
};

const parseJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.error || fallbackMessage);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const requestGenesysJson = async (url, options, fallbackMessage) => {
  let attempt = 0;

  while (true) {
    const response = await fetch(url, withGenesysFetchOptions(options));

    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(response);
      const delayMs = retryAfterMs != null && retryAfterMs > 0 ? retryAfterMs : Math.min(1000 * 2 ** attempt, 30000);
      await wait(delayMs);
      attempt += 1;
      continue;
    }

    return parseJsonResponse(response, fallbackMessage);
  }
};

const connect = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/organization",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(region ? { "x-genesys-region": region } : {}),
        ...(token ? { "x-genesys-token": token } : {}),
      },
      body: JSON.stringify({ region, token }),
    },
    "Genesys connection failed"
  );

  return payload.organization;
};

const connectFromVault = async () =>
  requestGenesysJson(
    "/api/genesys/organization",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
    "Genesys vault connection failed"
  ).then((payload) => payload.organization);

const getAccessibleOrganizations = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/accessible-organizations",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ region, token }),
    },
    "Accessible organizations request failed"
  );

  return {
    authorizedOrganizationCount: payload.authorizedOrganizationCount || 0,
    currentOrganizationId: payload.currentOrganizationId || "",
    organizations: payload.organizations || [],
    trustorsError: payload.trustorsError || "",
    trustorsLoaded: payload.trustorsLoaded || 0,
  };
};

const getUsers = async ({ region, token, force = false, onProgress, signal } = {}) => {
  const { users } = await loadSessionUsers({
    region,
    token,
    force,
    onProgress,
    signal,
  });

  return users;
};

const getUserRoleMappings = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/users/role-mappings",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys user role mappings request failed"
  );

  return payload.rows || [];
};

const getAuthorizationSubject = async ({ region, token, subjectId }) => {
  const payload = await requestGenesysJson(
    `/api/genesys/authorization/subjects/${encodeURIComponent(subjectId)}`,
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys authorization subject request failed"
  );

  return payload.subject || null;
};

const getUserRoutingSkills = async ({ region, token, userId }) => {
  const payload = await requestGenesysJson(
    `/api/genesys/users/${encodeURIComponent(userId)}/routingskills`,
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys user routing skills request failed"
  );

  return payload.skills || [];
};

const getUserSkillMappings = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/users/skill-mappings",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys user skill mappings request failed"
  );

  return payload.rows || [];
};

const getPhones = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/phones",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys phones request failed"
  );

  return payload.phones || [];
};

const getRoles = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/roles",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys roles request failed"
  );

  return payload.roles || [];
};

const getQueues = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/queues",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys queues request failed"
  );

  return payload.queues || [];
};

const getCampaigns = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/campaigns",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys campaigns request failed"
  );

  return payload.campaigns || [];
};

const getQueueMembers = async ({ region, token, queueId }) => {
  const payload = await requestGenesysJson(
    `/api/genesys/queues/${encodeURIComponent(queueId)}/members`,
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys queue members request failed"
  );

  return payload.members || [];
};

const getSkills = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/skills",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys skills request failed"
  );

  return payload.skills || [];
};

const getGroups = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/groups",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys groups request failed"
  );

  return payload.groups || [];
};

const getGroupMembers = async ({ region, token, groupId }) => {
  const payload = await requestGenesysJson(
    `/api/genesys/groups/${encodeURIComponent(groupId)}/members`,
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys group members request failed"
  );

  return payload.members || [];
};

const getPrompts = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/prompts",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys prompts request failed"
  );

  return payload.prompts || [];
};

const previewBulkSkillAssignment = async ({ region, token, userIds, skills }) => {
  return requestGenesysJson(
    "/api/genesys/bulk-skill-assignment/preview",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ userIds, skills }),
    },
    "Bulk skill assignment preview failed"
  );
};

const executeBulkSkillAssignment = async ({ region, token, users, skills }) => {
  return requestGenesysJson(
    "/api/genesys/bulk-skill-assignment/execute",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ users, skills }),
    },
    "Bulk skill assignment failed"
  );
};

const getDivisions = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/divisions",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys divisions request failed"
  );

  return payload.divisions || [];
};

const assignUsersToRoleDivision = async ({ region, token, userIds, roleId, divisionId }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/users/bulk-role-assign",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ userIds, roleId, divisionId }),
    },
    "Genesys bulk role assignment request failed"
  );

  return payload.results || [];
};

const assignRoutingSkillsToUsers = async ({ region, token, userIds, skills }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/users/bulk-skill-assign",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ userIds, skills }),
    },
    "Genesys bulk skill assignment request failed"
  );

  return payload.results || [];
};

const TERMINAL_JOB_STATUSES = new Set(["completed", "completed_with_errors", "failed", "cancelled"]);

const buildGenesysAuthHeaders = (region, token, extra = {}) => ({
  ...(region ? { "x-genesys-region": region } : {}),
  ...(token ? { "x-genesys-token": token } : {}),
  ...extra,
});

const submitJob = async ({ region, token, type, payload }) =>
  requestGenesysJson(
    "/api/jobs",
    {
      method: "POST",
      headers: buildGenesysAuthHeaders(region, token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ type, payload }),
    },
    "Job submission failed"
  );

const getJob = async ({ region, token, jobId }) =>
  requestGenesysJson(
    `/api/jobs/${encodeURIComponent(jobId)}`,
    {
      method: "GET",
      headers: buildGenesysAuthHeaders(region, token),
    },
    "Job status request failed"
  );

const getJobResults = async ({ region, token, jobId, offset = 0, limit = 1000, userId = null }) => {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });

  if (userId) {
    params.set("userId", String(userId));
  }

  return requestGenesysJson(
    `/api/jobs/${encodeURIComponent(jobId)}/results?${params.toString()}`,
    {
      method: "GET",
      headers: buildGenesysAuthHeaders(region, token),
    },
    "Job results request failed"
  );
};

const waitForJob = async ({
  region,
  token,
  jobId,
  onProgress,
  pollIntervalMs = 750,
  signal,
} = {}) => {
  while (true) {
    if (signal?.aborted) {
      const error = new Error("Job polling cancelled.");
      error.name = "AbortError";
      throw error;
    }

    const job = await getJob({ region, token, jobId });
    if (typeof onProgress === "function") {
      onProgress(job);
    }

    if (TERMINAL_JOB_STATUSES.has(job.status)) {
      return job;
    }

    await wait(pollIntervalMs);
  }
};

const cancelJob = async ({ region, token, jobId }) =>
  requestGenesysJson(
    `/api/jobs/${encodeURIComponent(jobId)}/cancel`,
    {
      method: "POST",
      headers: buildGenesysAuthHeaders(region, token, { "Content-Type": "application/json" }),
    },
    "Job cancel request failed"
  );

const runBulkJobViaJob = async ({
  region,
  token,
  type,
  payload,
  itemCount = 0,
  onProgress,
  onJobSubmitted,
  signal,
}) => {
  const submission = await submitJob({
    region,
    token,
    type,
    payload,
  });

  if (typeof onJobSubmitted === "function") {
    onJobSubmitted(submission);
  }

  const job = await waitForJob({
    region,
    token,
    jobId: submission.jobId,
    onProgress,
    signal,
  });

  const resultsPayload = await getJobResults({
    region,
    token,
    jobId: submission.jobId,
    offset: 0,
    limit: Math.max(itemCount, 1000),
  });

  return {
    job,
    results: resultsPayload.results || [],
  };
};

const assignRoutingSkillsToUsersViaJob = async (options) =>
  runBulkJobViaJob({
    ...options,
    type: "bulk-skill-assign",
    payload: {
      userIds: options.userIds,
      skills: options.skills,
    },
    itemCount: options.userIds?.length || 0,
  });

const assignUsersToRoleDivisionViaJob = async (options) =>
  runBulkJobViaJob({
    ...options,
    type: "bulk-role-assign",
    payload: {
      userIds: options.userIds,
      roleAssignments: options.roleAssignments,
    },
    itemCount: (options.userIds?.length || 0) * (options.roleAssignments?.length || 0),
  });

const setUsersAutoAnswerViaJob = async (options) =>
  runBulkJobViaJob({
    ...options,
    type: "bulk-auto-answer",
    payload: {
      userIds: options.userIds,
      acdAutoAnswer: options.acdAutoAnswer,
    },
    itemCount: options.userIds?.length || 0,
  });

const resetUsersPasswordsViaJob = async (options) =>
  runBulkJobViaJob({
    ...options,
    type: "bulk-password-reset",
    payload: {
      passwordResets: options.passwordResets,
    },
    itemCount: options.passwordResets?.length || 0,
  });

const logoffUsersViaJob = async (options) =>
  runBulkJobViaJob({
    ...options,
    type: "bulk-logoff",
    payload: {
      userIds: options.userIds,
    },
    itemCount: options.userIds?.length || 0,
  });

const disconnectConversationsViaJob = async (options) =>
  runBulkJobViaJob({
    ...options,
    type: "bulk-disconnect",
    payload: {
      conversationIds: options.conversationIds,
    },
    itemCount: options.conversationIds?.length || 0,
  });

const updateConversationPrioritiesViaJob = async (options) =>
  runBulkJobViaJob({
    ...options,
    type: "bulk-priority-update",
    payload: {
      updates: options.updates,
    },
    itemCount: options.updates?.length || 0,
  });

const buildPhonesViaJob = async (options) =>
  runBulkJobViaJob({
    ...options,
    type: "bulk-phone-build",
    payload: {
      users: options.users,
      templatePhoneId: options.templatePhoneId,
    },
    itemCount: options.users?.length || 0,
  });

const deletePhonesViaJob = async (options) =>
  runBulkJobViaJob({
    ...options,
    type: "bulk-phone-delete",
    payload: {
      phoneIds: options.phoneIds,
    },
    itemCount: options.phoneIds?.length || 0,
  });

const loadSchedulesViaJob = async (options) =>
  runBulkJobViaJob({
    ...options,
    type: "bulk-load-schedules",
    payload: {
      schedules: options.schedules,
    },
    itemCount: options.schedules?.length || 0,
  });

const getPasswordPolicy = async ({ region, token }) => {
  return requestGenesysJson(
    "/api/genesys/password-policy",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys password policy request failed"
  );
};

const setUsersAutoAnswer = async ({ region, token, userIds, acdAutoAnswer }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/users/bulk-auto-answer",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ userIds, acdAutoAnswer }),
    },
    "Genesys bulk auto-answer request failed"
  );

  return payload.users || [];
};

const resetUsersPasswords = async ({ region, token, passwordResets }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/users/bulk-password-reset",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ passwordResets }),
    },
    "Genesys bulk password reset request failed"
  );

  return payload.results || [];
};

const logoffUsers = async ({ region, token, userIds }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/users/bulk-logoff",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ userIds }),
    },
    "Genesys bulk logoff request failed"
  );

  return payload.results || [];
};

const queryOpenQueueInteractions = async ({
  region,
  token,
  queueId,
  lookbackDays,
  scope,
  mediaTypes,
  minDurationMinutes,
}) => {
  const payload = await requestGenesysJson(
    "/api/genesys/analytics/open-interactions/query",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({
        queueId,
        lookbackDays,
        scope,
        mediaTypes,
        minDurationMinutes,
      }),
    },
    "Genesys open interactions query failed"
  );

  return payload.interactions || [];
};

const disconnectConversations = async ({ region, token, conversationIds }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/conversations/bulk-disconnect",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ conversationIds }),
    },
    "Genesys bulk disconnect request failed"
  );

  return payload.results || [];
};

const buildPhones = async ({ region, token, users, templatePhoneId }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/phones/bulk-build",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ users, templatePhoneId }),
    },
    "Genesys bulk phone build request failed"
  );

  return payload.results || [];
};

const loadSchedules = async ({ region, token, schedules }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/schedules/load",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ schedules }),
    },
    "Genesys schedule load request failed"
  );

  return payload.results || [];
};

const createMasterAdminRole = async ({ region, token, roleName, description }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/master-admin-role",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ roleName, description }),
    },
    "Genesys create master admin role request failed"
  );

  return payload.role;
};

const getScheduleTemplates = async () => {
  const response = await fetch("/api/config/schedule-templates", { cache: "no-cache" });
  const payload = await parseJsonResponse(response, "Schedule template request failed");
  return payload.catalog || {};
};

const getConversation = async ({ region, token, conversationId }) => {
  const payload = await requestGenesysJson(
    `/api/genesys/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys conversation request failed"
  );

  return payload.conversation;
};

const getFlowExecutions = async ({ region, token, conversationId }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/flow-executions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ conversationId }),
    },
    "Genesys flow executions request failed"
  );

  return payload.executions || [];
};

const spoofOutboundCall = async ({ region, token, phoneNumber, callerId, callerIdName }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/call-spoof",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ phoneNumber, callerId, callerIdName }),
    },
    "Genesys outbound call spoof request failed"
  );

  return payload.call;
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
  const payload = await requestGenesysJson(
    "/api/genesys/call-spoof/inbound",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({
        callUserId,
        inboundDnis,
        callerId,
        callerIdName,
        uuiData,
        callDateTime,
        callTimeZone,
        description,
        customAttributes,
      }),
    },
    "Genesys inbound call spoof request failed"
  );

  return payload.call;
};

const getCurrentUser = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/users/me",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys current user request failed"
  );

  return payload.user;
};

const getUser = async ({ region, token, userId }) => {
  const payload = await requestGenesysJson(
    `/api/genesys/users/${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys user request failed"
  );

  return payload.user;
};

const getBotFlows = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/bot-flows",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys bot flows request failed"
  );

  return payload.flows || [];
};

const getBotUtterances = async ({ region, token, flowId, filters = {} }) => {
  const params = new URLSearchParams();
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

  const query = params.toString();
  const path = `/api/genesys/bot-flows/${encodeURIComponent(flowId)}/utterances${query ? `?${query}` : ""}`;

  return requestGenesysJson(
    path,
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys bot utterances request failed"
  );
};

const getIntentHealth = async ({ region, token, flowId, versionId }) => {
  const payload = await requestGenesysJson(
    `/api/genesys/bot-flows/${encodeURIComponent(flowId)}/versions/${encodeURIComponent(versionId)}/health`,
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys intent health request failed"
  );

  return payload.health;
};

const getAuditServiceMapping = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/audits/service-mapping",
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys audit service mapping request failed"
  );

  return payload.serviceMapping;
};

const createAuditQuery = async ({ region, token, query }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/audits/query",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ query }),
    },
    "Genesys audit query request failed"
  );

  return payload.query;
};

const getAuditQueryStatus = async ({ region, token, transactionId }) => {
  const payload = await requestGenesysJson(
    `/api/genesys/audits/query/${encodeURIComponent(transactionId)}/status`,
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys audit query status request failed"
  );

  return payload.status;
};

const getAuditQueryResults = async ({ region, token, transactionId, cursor = "" }) => {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }

  const query = params.toString();
  const payload = await requestGenesysJson(
    `/api/genesys/audits/query/${encodeURIComponent(transactionId)}/results${query ? `?${query}` : ""}`,
    {
      method: "GET",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys audit query results request failed"
  );

  return payload.results;
};

const createNotificationChannel = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/notifications/channels",
    {
      method: "POST",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys notification channel request failed"
  );

  return payload.channel;
};

const subscribeNotificationTopics = async ({ region, token, channelId, topics }) => {
  const payload = await requestGenesysJson(
    `/api/genesys/notifications/channels/${encodeURIComponent(channelId)}/subscriptions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ topics }),
    },
    "Genesys notification subscription request failed"
  );

  return payload.subscription || { succeeded: [], failed: [] };
};

const deleteNotificationChannel = async ({ region, token, channelId }) => {
  const response = await fetch(
    `/api/genesys/notifications/channels/${encodeURIComponent(channelId)}`,
    {
      method: "DELETE",
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    }
  );

  if (!response.ok && response.status !== 204) {
    await parseJsonResponse(response, "Genesys notification channel delete failed");
  }
};

const getAvailableNotificationTopics = async ({ region, token }) =>
  requestGenesysJson(
    "/api/genesys/notifications/availabletopics",
    {
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys available notification topics request failed"
  );

const getSites = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/sites",
    {
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys sites request failed"
  );

  return payload.sites || [];
};

const getDataTables = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/datatables",
    {
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys data tables request failed"
  );

  return payload.dataTables || [];
};

const exportDataTables = async ({ region, token, tableIds }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/datatables/export",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ tableIds }),
    },
    "Genesys data table export failed"
  );

  return payload.exports || [];
};

const movePhonesToSite = async ({ region, token, phoneIds, siteId, siteName = "" }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/phones/bulk-move",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ phoneIds, siteId, siteName }),
    },
    "Genesys phone move failed"
  );

  return payload.results || [];
};

const movePhonesToSiteViaJob = async (options) =>
  runBulkJobViaJob({
    ...options,
    type: "bulk-phone-move",
    payload: {
      phoneIds: options.phoneIds,
      siteId: options.siteId,
      siteName: options.siteName || "",
    },
    itemCount: options.phoneIds?.length || 0,
  });

const deletePhones = async ({ region, token, phoneIds }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/phones/bulk-delete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ phoneIds }),
    },
    "Genesys phone delete failed"
  );

  return payload.results || [];
};

const updateConversationPriorities = async ({ region, token, updates }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/conversations/bulk-priority",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
      body: JSON.stringify({ updates }),
    },
    "Genesys conversation priority update failed"
  );

  return payload.results || [];
};

const getOrganizationLimits = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/organizations/limits",
    {
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys organization limits request failed"
  );

  return payload.limits || payload;
};

const getTelephonyCallMetrics = async ({ region, token }) => {
  const payload = await requestGenesysJson(
    "/api/genesys/telephony/calls/metrics",
    {
      headers: {
        "x-genesys-region": region,
        "x-genesys-token": token,
      },
    },
    "Genesys telephony metrics request failed"
  );

  return payload.metrics || {};
};

const loadGenesysRegions = async () => {
  const response = await fetch("/data/genesys_regions.json", { cache: "no-cache" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
};

export {
  assignRoutingSkillsToUsers,
  assignRoutingSkillsToUsersViaJob,
  assignUsersToRoleDivision,
  assignUsersToRoleDivisionViaJob,
  buildPhonesViaJob,
  cancelJob,
  deletePhonesViaJob,
  disconnectConversationsViaJob,
  getJob,
  getJobResults,
  submitJob,
  waitForJob,
  buildPhones,
  connect,
  connectFromVault,
  createAuditQuery,
  createMasterAdminRole,
  createNotificationChannel,
  deleteNotificationChannel,
  deletePhones,
  disconnectConversations,
  exportDataTables,
  executeBulkSkillAssignment,
  getAccessibleOrganizations,
  getAuditQueryResults,
  getAuditQueryStatus,
  getAuditServiceMapping,
  getAvailableNotificationTopics,
  getAuthorizationSubject,
  getBotFlows,
  getBotUtterances,
  getConversation,
  getCurrentUser,
  getDataTables,
  getFlowExecutions,
  getGroupMembers,
  getGroups,
  getDivisions,
  getIntentHealth,
  getPasswordPolicy,
  getPhones,
  getOrganizationLimits,
  getPrompts,
  getQueueMembers,
  getQueues,
  getCampaigns,
  getRoles,
  getSkills,
  getUser,
  getUsers,
  loadSessionUsers,
  getUserRoleMappings,
  getUserRoutingSkills,
  getUserSkillMappings,
  getScheduleTemplates,
  getSites,
  getTelephonyCallMetrics,
  loadGenesysRegions,
  loadSchedules,
  logoffUsers,
  loadSchedulesViaJob,
  logoffUsersViaJob,
  movePhonesToSite,
  movePhonesToSiteViaJob,
  resetUsersPasswordsViaJob,
  runBulkJobViaJob,
  setUsersAutoAnswerViaJob,
  updateConversationPrioritiesViaJob,
  previewBulkSkillAssignment,
  queryOpenQueueInteractions,
  resetUsersPasswords,
  setUsersAutoAnswer,
  spoofInboundCall,
  spoofOutboundCall,
  subscribeNotificationTopics,
  updateConversationPriorities,
};
