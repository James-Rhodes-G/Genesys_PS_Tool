import { getInventoryData } from "./inventory-store.js";
import { loadAllQueueMembers, peekQueueMembersById } from "./queue-members-cache.js";

const isWebRtcStylePhone = (phone) =>
  typeof phone?.name === "string" && phone.name.endsWith("_webRTC");

const HEALTH_CHECK_DEFINITIONS = [
  {
    id: "users-without-roles",
    issue: "Users without Roles",
    dependsOn: ["users"],
    buildRows: ({ users }) =>
      (users || [])
        .filter((user) => !Array.isArray(user.authorization?.roles) || user.authorization.roles.length === 0)
        .map((user) => ({
          name: user.name || "",
          userId: user.id || "",
          userName: user.userName || user.username || "",
          department: user.department || "",
          state: user.state || "",
          divisionName: user.division?.name || "",
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    createExportMeta: (resultId, rows, title, status) => ({
      resultId,
      title,
      status,
      exportType: "health_check_users_without_roles",
      rows,
      editMode: false,
      availableColumns: [
        { key: "name", header: "Name" },
        { key: "userId", header: "User ID" },
        { key: "userName", header: "User Name" },
        { key: "department", header: "Department" },
        { key: "state", header: "State" },
        { key: "divisionName", header: "Division" },
      ],
      selectedColumnKeys: ["name", "userId", "userName", "department", "state", "divisionName"],
    }),
  },
  {
    id: "users-without-skills",
    issue: "Users without Skills",
    dependsOn: ["users"],
    buildRows: ({ users }) =>
      (users || [])
        .filter((user) => !Array.isArray(user.skills) || user.skills.length === 0)
        .map((user) => ({
          name: user.name || "",
          userId: user.id || "",
          userName: user.userName || user.username || "",
          department: user.department || "",
          state: user.state || "",
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    createExportMeta: (resultId, rows, title, status) => ({
      resultId,
      title,
      status,
      exportType: "health_check_users_without_skills",
      rows,
      editMode: false,
      availableColumns: [
        { key: "name", header: "Name" },
        { key: "userId", header: "User ID" },
        { key: "userName", header: "User Name" },
        { key: "department", header: "Department" },
        { key: "state", header: "State" },
      ],
      selectedColumnKeys: ["name", "userId", "userName", "department", "state"],
    }),
  },
  {
    id: "users-without-phones",
    issue: "Users without Phones",
    dependsOn: ["users", "phones"],
    buildRows: ({ users, phones }) => {
      const phoneUserIds = new Set((phones || []).map((phone) => phone?.webRtcUser?.id).filter(Boolean));

      return (users || [])
        .filter((user) => user?.id && !phoneUserIds.has(user.id))
        .map((user) => ({
          name: user.name || "",
          userId: user.id || "",
          userName: user.userName || user.username || "",
          department: user.department || "",
          state: user.state || "",
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
    },
    createExportMeta: (resultId, rows, title, status) => ({
      resultId,
      title,
      status,
      exportType: "health_check_users_without_phones",
      rows,
      editMode: false,
      availableColumns: [
        { key: "name", header: "Name" },
        { key: "userId", header: "User ID" },
        { key: "userName", header: "User Name" },
        { key: "department", header: "Department" },
        { key: "state", header: "State" },
      ],
      selectedColumnKeys: ["name", "userId", "userName", "department", "state"],
    }),
  },
  {
    id: "webrtc-without-user",
    issue: "WebRTC Phones with no corresponding User",
    dependsOn: ["phones"],
    buildRows: ({ phones }) =>
      (phones || [])
        .filter((phone) => isWebRtcStylePhone(phone) && !phone?.webRtcUser?.id)
        .map((phone) => ({
          phoneId: phone.id || "",
          phoneName: phone.name || "",
          siteName: phone.site?.name || "",
          siteId: phone.site?.id || "",
        }))
        .sort((left, right) => left.phoneName.localeCompare(right.phoneName)),
    createExportMeta: (resultId, rows, title, status) => ({
      resultId,
      title,
      status,
      exportType: "health_check_webrtc_without_user",
      rows,
      editMode: false,
      availableColumns: [
        { key: "phoneName", header: "Phone Name" },
        { key: "phoneId", header: "Phone ID" },
        { key: "siteName", header: "Site" },
        { key: "siteId", header: "Site ID" },
      ],
      selectedColumnKeys: ["phoneName", "phoneId", "siteName", "siteId"],
    }),
  },
  {
    id: "queues-without-members",
    issue: "Queues with no Members",
    dependsOn: ["queues", "queueMembers"],
    buildRows: ({ queues, queueMembersById }) =>
      (queues || [])
        .filter((queue) => (queueMembersById?.[queue.id] || []).length === 0)
        .map((queue) => ({
          queueName: queue.name || "",
          queueId: queue.id || "",
          memberCount: 0,
        }))
        .sort((left, right) => left.queueName.localeCompare(right.queueName)),
    createExportMeta: (resultId, rows, title, status) => ({
      resultId,
      title,
      status,
      exportType: "health_check_queues_without_members",
      rows,
      editMode: false,
      availableColumns: [
        { key: "queueName", header: "Queue Name" },
        { key: "queueId", header: "Queue ID" },
        { key: "memberCount", header: "Member Count" },
      ],
      selectedColumnKeys: ["queueName", "queueId", "memberCount"],
    }),
  },
];

const computeHealthChecks = ({ users, phones, queues, queueMembersById }) => {
  const context = { users, phones, queues, queueMembersById };

  return HEALTH_CHECK_DEFINITIONS.flatMap((definition) => {
    if (definition.dependsOn.includes("users") && !Array.isArray(users)) {
      return [];
    }
    if (definition.dependsOn.includes("phones") && !Array.isArray(phones)) {
      return [];
    }
    if (definition.dependsOn.includes("queues") && !Array.isArray(queues)) {
      return [];
    }
    if (definition.dependsOn.includes("queueMembers") && !queueMembersById) {
      return [
        {
          id: definition.id,
          issue: definition.issue,
          count: null,
          dependsOn: definition.dependsOn,
          needsQueueMembers: true,
        },
      ];
    }

    const rows = definition.buildRows(context);

    return [
      {
        id: definition.id,
        issue: definition.issue,
        count: rows.length,
        dependsOn: definition.dependsOn,
      },
    ];
  });
};

const resolveHealthCheckContext = async (deps, credentials, checkId) => {
  const definition = HEALTH_CHECK_DEFINITIONS.find((entry) => entry.id === checkId);
  if (!definition) {
    throw new Error(`Unknown health check: ${checkId}`);
  }

  let users = null;
  let phones = null;
  let queues = null;
  let queueMembersById = null;

  if (definition.dependsOn.includes("users")) {
    const userStatus = await deps.fetchUserSyncStatus().catch(() => ({ sync: {} }));
    if (userStatus?.sync?.status !== "ready") {
      throw new Error("User cache is not ready");
    }

    const payload = await deps.fetchCachedUsers().catch(() => ({ users: [] }));
    users = Array.isArray(payload?.users) ? payload.users : [];
  }

  if (definition.dependsOn.includes("phones")) {
    phones = deps.peekCachedPhones();
    if (!Array.isArray(phones)) {
      throw new Error("Phone inventory is not loaded");
    }
  }

  if (definition.dependsOn.includes("queues")) {
    queues = getInventoryData("queues");
    if (!Array.isArray(queues)) {
      throw new Error("Queue inventory is not loaded");
    }
  }

  if (definition.dependsOn.includes("queueMembers")) {
    queueMembersById = await loadAllQueueMembers(deps, credentials);
  }

  return { users, phones, queues, queueMembersById };
};

const buildHealthCheckReport = (checkId, context, resultId) => {
  const definition = HEALTH_CHECK_DEFINITIONS.find((entry) => entry.id === checkId);
  if (!definition) {
    throw new Error(`Unknown health check: ${checkId}`);
  }

  const rows = definition.buildRows(context);
  const title = `Health Check: ${definition.issue}`;
  const status = rows.length
    ? `${rows.length} matching record${rows.length === 1 ? "" : "s"}`
    : "No matching records";

  return {
    title,
    status,
    rows,
    exportMeta: definition.createExportMeta(resultId, rows, title, status),
  };
};

export {
  HEALTH_CHECK_DEFINITIONS,
  buildHealthCheckReport,
  computeHealthChecks,
  peekQueueMembersById,
  resolveHealthCheckContext,
};
