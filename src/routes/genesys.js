import { Router } from "express";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  assignRoutingSkillsToUsers,
  assignUsersToRoleDivision,
  buildPhones,
  createAuditQuery,
  createMasterAdminRole,
  createNotificationChannel,
  deleteNotificationChannel,
  deletePhones,
  disconnectConversations,
  exportDataTables,
  getAvailableNotificationTopics,
  getDataTables,
  getSites,
  movePhonesToSite,
  updateConversationPriorities,
  getAuditQueryResults,
  getAuditQueryStatus,
  getAuditServiceMapping,
  getBotFlows,
  getBotUtterances,
  getConversation,
  getCurrentUser,
  getFlowExecutions,
  downloadFlowExecution,
  getGroups,
  getGroupMembers,
  addUserRoutingSkill,
  getIntentHealth,
  getOrganizationMe,
  getOrganizationLimits,
  getOrgauthorizationTrustor,
  getOrgauthorizationTrustors,
  getPrompts,
  queryOpenQueueInteractions,
  getQueueMembers,
  getPhones,
  getCampaigns,
  getQueues,
  getRoles,
  getSkills,
  getUser,
  getUserRoutingSkills,
  getUsers,
  getUserRoleMappings,
  getUserSkillMappings,
  getAuthorizationSubject,
  getDivisions,
  getGenesysDomainForRegion,
  getPasswordPolicy,
  loadSchedules,
  logoffUsers,
  resetUsersPasswords,
  setUsersAutoAnswer,
  getTelephonyCallMetrics,
  spoofInboundCall,
  spoofOutboundCall,
  subscribeNotificationTopicsWithResults,
} from "../lib/genesys.js";
import { parseExecutionJson } from "../lib/flow-execution-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const scheduleTemplatesPath = path.join(projectRoot, "public", "data", "global_holiday.json");

const createGenesysRouter = () => {
  const router = Router();

  const getCredentials = (req) => {
    if (req.genesysCredentials?.region && req.genesysCredentials?.token) {
      return req.genesysCredentials;
    }

    const region = req.body?.region || req.query?.region || req.get("x-genesys-region");
    const token = req.body?.token || req.query?.token || req.get("x-genesys-token");

    return { region, token };
  };

  const requireCredentials = (req, res) => {
    const { region, token } = getCredentials(req);

    if (!region || !token) {
      res.status(400).json({ error: "Both region and token are required." });
      return null;
    }

    return { region, token };
  };

  const registerExportRoute = ({ routePath, label, field, handler }) => {
    router.get(routePath, async (req, res) => {
      const credentials = requireCredentials(req, res);
      console.log(`[genesys] GET ${routePath}`, {
        region: credentials?.region,
        hasToken: Boolean(credentials?.token),
      });

      if (!credentials) {
        console.warn(`[genesys] missing ${label} credentials`, {
          hasRegion: Boolean(req.query?.region || req.get("x-genesys-region")),
          hasToken: Boolean(req.query?.token || req.get("x-genesys-token")),
        });
        return;
      }

      try {
        const response = await handler(credentials);
        console.log(`[genesys] ${label} export succeeded`, {
          region: credentials.region,
          count: Array.isArray(response) ? response.length : 0,
        });
        res.status(200).json({ [field]: response || [] });
      } catch (error) {
        console.error(`[genesys] ${label} export failed`, {
          region: credentials.region,
          status: error.status || 502,
          message: error.message,
          details: error.details || null,
        });
        res.status(error.status || 502).json({
          error: error.message,
          details: error.details || null,
        });
      }
    });
  };

  router.post("/api/genesys/organization", async (req, res) => {
    const { region, token } = getCredentials(req);
    console.log("[genesys] POST /api/genesys/organization", {
      region,
      hasToken: Boolean(token),
    });

    if (!region || !token) {
      console.warn("[genesys] missing organization credentials", {
        hasRegion: Boolean(region),
        hasToken: Boolean(token),
      });
      res.status(400).json({ error: "Both region and token are required." });
      return;
    }

    try {
      const organization = await getOrganizationMe({ region, token });
      console.log("[genesys] organization lookup succeeded", {
        region,
        organizationId: organization?.id,
        organizationName: organization?.name,
      });
      res.status(200).json({ organization });
    } catch (error) {
      console.error("[genesys] organization lookup failed", {
        region,
        status: error.status || 502,
        message: error.message,
        details: error.details || null,
      });
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.get("/api/genesys/organizations/limits", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    try {
      const limits = await getOrganizationLimits(credentials);
      res.status(200).json({ limits });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.get("/api/genesys/telephony/calls/metrics", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    try {
      const metrics = await getTelephonyCallMetrics(credentials);
      res.status(200).json({ metrics });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.get("/api/genesys/users/me", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    try {
      const user = await getCurrentUser(credentials);
      res.status(200).json({ user });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.get("/api/genesys/users/:userId", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    try {
      const user = await getUser({
        ...credentials,
        userId: req.params.userId,
      });
      res.status(200).json({ user });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  registerExportRoute({
    routePath: "/api/genesys/users",
    label: "users",
    field: "users",
    handler: getUsers,
  });

  registerExportRoute({
    routePath: "/api/genesys/users/role-mappings",
    label: "user role mappings",
    field: "rows",
    handler: getUserRoleMappings,
  });

  registerExportRoute({
    routePath: "/api/genesys/users/skill-mappings",
    label: "user skill mappings",
    field: "rows",
    handler: getUserSkillMappings,
  });

  registerExportRoute({
    routePath: "/api/genesys/phones",
    label: "phones",
    field: "phones",
    handler: getPhones,
  });

  registerExportRoute({
    routePath: "/api/genesys/sites",
    label: "sites",
    field: "sites",
    handler: getSites,
  });

  registerExportRoute({
    routePath: "/api/genesys/datatables",
    label: "data tables",
    field: "dataTables",
    handler: getDataTables,
  });

  registerExportRoute({
    routePath: "/api/genesys/roles",
    label: "roles",
    field: "roles",
    handler: getRoles,
  });

  registerExportRoute({
    routePath: "/api/genesys/divisions",
    label: "divisions",
    field: "divisions",
    handler: getDivisions,
  });

  router.get("/api/genesys/authorization/subjects/:subjectId", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const subjectId = String(req.params.subjectId || "").trim();
    if (!subjectId) {
      res.status(400).json({ error: "subjectId is required." });
      return;
    }

    try {
      const subject = await getAuthorizationSubject({ ...credentials, subjectId });
      res.status(200).json({ subject });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.get("/api/genesys/users/:userId/routingskills", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "userId is required." });
      return;
    }

    try {
      const skills = await getUserRoutingSkills({ ...credentials, userId });
      res.status(200).json({ skills: skills || [] });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  registerExportRoute({
    routePath: "/api/genesys/queues",
    label: "queues",
    field: "queues",
    handler: getQueues,
  });

  registerExportRoute({
    routePath: "/api/genesys/campaigns",
    label: "campaigns",
    field: "campaigns",
    handler: getCampaigns,
  });

  registerExportRoute({
    routePath: "/api/genesys/skills",
    label: "skills",
    field: "skills",
    handler: getSkills,
  });

  registerExportRoute({
    routePath: "/api/genesys/groups",
    label: "groups",
    field: "groups",
    handler: getGroups,
  });

  registerExportRoute({
    routePath: "/api/genesys/prompts",
    label: "prompts",
    field: "prompts",
    handler: getPrompts,
  });

  router.get("/api/genesys/queues/:queueId/members", async (req, res) => {
    const credentials = requireCredentials(req, res);
    const { queueId } = req.params;

    console.log("[genesys] GET /api/genesys/queues/:queueId/members", {
      region: credentials?.region,
      queueId,
      hasToken: Boolean(credentials?.token),
    });

    if (!credentials) {
      return;
    }

    try {
      const members = await getQueueMembers({ ...credentials, queueId });
      console.log("[genesys] queue members export succeeded", {
        region: credentials.region,
        queueId,
        count: Array.isArray(members) ? members.length : 0,
      });
      res.status(200).json({ members: members || [] });
    } catch (error) {
      console.error("[genesys] queue members export failed", {
        region: credentials.region,
        queueId,
        status: error.status || 502,
        message: error.message,
        details: error.details || null,
      });
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.get("/api/genesys/groups/:groupId/members", async (req, res) => {
    const credentials = requireCredentials(req, res);
    const { groupId } = req.params;

    console.log("[genesys] GET /api/genesys/groups/:groupId/members", {
      region: credentials?.region,
      groupId,
      hasToken: Boolean(credentials?.token),
    });

    if (!credentials) {
      return;
    }

    try {
      const members = await getGroupMembers({ ...credentials, groupId });
      console.log("[genesys] group members export succeeded", {
        region: credentials.region,
        groupId,
        count: Array.isArray(members) ? members.length : 0,
      });
      res.status(200).json({ members: members || [] });
    } catch (error) {
      console.error("[genesys] group members export failed", {
        region: credentials.region,
        groupId,
        status: error.status || 502,
        message: error.message,
        details: error.details || null,
      });
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });


  router.post("/api/genesys/bulk-skill-assignment/preview", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.filter(Boolean) : [];
    const skills = Array.isArray(req.body?.skills) ? req.body.skills.filter((skill) => skill?.id) : [];

    if (userIds.length === 0 || skills.length === 0) {
      res.status(400).json({ error: "At least one user and one skill are required." });
      return;
    }

    try {
      const preview = await Promise.all(
        userIds.map(async (userId) => {
          const existing = await getUserRoutingSkills({ ...credentials, userId });
          const existingById = new Map((Array.isArray(existing) ? existing : []).map((skill) => [skill.id, skill]));
          const toAdd = skills.filter((skill) => !existingById.has(skill.id));
          const alreadyAssigned = skills.filter((skill) => existingById.has(skill.id));

          return {
            userId,
            existingCount: existingById.size,
            toAdd,
            alreadyAssigned,
          };
        })
      );

      res.status(200).json({
        preview,
        summary: {
          usersScanned: preview.length,
          usersWithChanges: preview.filter((row) => row.toAdd.length > 0).length,
          totalAssignmentsToAdd: preview.reduce((sum, row) => sum + row.toAdd.length, 0),
        },
      });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/bulk-skill-assignment/execute", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const users = Array.isArray(req.body?.users) ? req.body.users.filter((user) => user?.id) : [];
    const skills = Array.isArray(req.body?.skills) ? req.body.skills.filter((skill) => skill?.id) : [];

    if (users.length === 0 || skills.length === 0) {
      res.status(400).json({ error: "At least one user and one skill are required." });
      return;
    }

    try {
      const results = [];

      for (const user of users) {
        const existing = await getUserRoutingSkills({ ...credentials, userId: user.id });
        const existingIds = new Set((Array.isArray(existing) ? existing : []).map((skill) => skill.id));
        const toAdd = skills.filter((skill) => !existingIds.has(skill.id));
        const added = [];

        for (const skill of toAdd) {
          await addUserRoutingSkill({
            ...credentials,
            userId: user.id,
            skill: { id: skill.id, proficiency: Number(skill.proficiency ?? 0) },
          });
          added.push({ id: skill.id, proficiency: Number(skill.proficiency ?? 0) });
        }

        results.push({
          userId: user.id,
          userName: user.name || user.email || user.id,
          added,
          skipped: skills.filter((skill) => existingIds.has(skill.id)).map((skill) => ({ id: skill.id })),
        });
      }

      res.status(200).json({
        results,
        summary: {
          usersProcessed: results.length,
          usersChanged: results.filter((row) => row.added.length > 0).length,
          totalSkillsAdded: results.reduce((sum, row) => sum + row.added.length, 0),
        },
      });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });


  router.get("/api/genesys/password-policy", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    try {
      const raw = await getPasswordPolicy(credentials);
      res.status(200).json({
        available: true,
        source: "organization",
        raw,
      });
    } catch (error) {
      res.status(200).json({
        available: false,
        source: "unavailable",
        warning: error.message || "Organization password policy is unavailable.",
        raw: error.details || null,
      });
    }
  });


  router.post("/api/genesys/users/bulk-auto-answer", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.filter(Boolean) : [];
    const acdAutoAnswer = req.body?.acdAutoAnswer;

    if (userIds.length === 0) {
      res.status(400).json({ error: "userIds must be a non-empty array." });
      return;
    }

    if (typeof acdAutoAnswer !== "boolean") {
      res.status(400).json({ error: "acdAutoAnswer must be a boolean." });
      return;
    }

    try {
      const users = await setUsersAutoAnswer({ ...credentials, userIds, acdAutoAnswer });
      res.status(200).json({ users });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });


  router.post("/api/genesys/users/bulk-password-reset", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const passwordResets = Array.isArray(req.body?.passwordResets) ? req.body.passwordResets : [];

    if (passwordResets.length === 0) {
      res.status(400).json({ error: "passwordResets must be a non-empty array." });
      return;
    }

    const invalidReset = passwordResets.find(
      (entry) => !entry?.userId || typeof entry?.newPassword !== "string" || !entry.newPassword
    );
    if (invalidReset) {
      res.status(400).json({ error: "Each password reset entry must include userId and newPassword." });
      return;
    }

    try {
      const results = await resetUsersPasswords({ ...credentials, passwordResets });
      res.status(200).json({ results });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });


  router.post("/api/genesys/users/bulk-logoff", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.filter(Boolean) : [];

    if (userIds.length === 0) {
      res.status(400).json({ error: "userIds must be a non-empty array." });
      return;
    }

    try {
      const results = await logoffUsers({ ...credentials, userIds });
      res.status(200).json({ results });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/analytics/open-interactions/query", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const queueId = String(req.body?.queueId || "").trim();
    if (!queueId) {
      res.status(400).json({ error: "queueId is required." });
      return;
    }

    try {
      const interactions = await queryOpenQueueInteractions({
        ...credentials,
        queueId,
        lookbackDays: req.body?.lookbackDays,
        scope: req.body?.scope,
        mediaTypes: req.body?.mediaTypes,
        minDurationMinutes: req.body?.minDurationMinutes,
      });
      res.status(200).json({ interactions });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/datatables/export", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const tableIds = Array.isArray(req.body?.tableIds) ? req.body.tableIds.filter(Boolean) : [];
    if (!tableIds.length) {
      res.status(400).json({ error: "tableIds must be a non-empty array." });
      return;
    }

    try {
      const exports = await exportDataTables({ ...credentials, tableIds });
      res.status(200).json({ exports });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/conversations/bulk-priority", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    if (!updates.length) {
      res.status(400).json({ error: "updates must be a non-empty array." });
      return;
    }

    try {
      const results = await updateConversationPriorities({ ...credentials, updates });
      res.status(200).json({ results });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/conversations/bulk-disconnect", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const conversationIds = Array.isArray(req.body?.conversationIds)
      ? req.body.conversationIds.filter(Boolean)
      : [];

    if (conversationIds.length === 0) {
      res.status(400).json({ error: "conversationIds must be a non-empty array." });
      return;
    }

    try {
      const results = await disconnectConversations({ ...credentials, conversationIds });
      res.status(200).json({ results });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });


  router.post("/api/genesys/phones/bulk-move", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const phoneIds = Array.isArray(req.body?.phoneIds) ? req.body.phoneIds.filter(Boolean) : [];
    const siteId = String(req.body?.siteId || "").trim();
    const siteName = String(req.body?.siteName || "").trim();

    if (!phoneIds.length) {
      res.status(400).json({ error: "phoneIds must be a non-empty array." });
      return;
    }

    if (!siteId) {
      res.status(400).json({ error: "siteId is required." });
      return;
    }

    try {
      const results = await movePhonesToSite({ ...credentials, phoneIds, siteId, siteName });
      res.status(200).json({ results });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/phones/bulk-delete", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const phoneIds = Array.isArray(req.body?.phoneIds) ? req.body.phoneIds.filter(Boolean) : [];
    if (!phoneIds.length) {
      res.status(400).json({ error: "phoneIds must be a non-empty array." });
      return;
    }

    try {
      const results = await deletePhones({ ...credentials, phoneIds });
      res.status(200).json({ results });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/phones/bulk-build", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const users = Array.isArray(req.body?.users) ? req.body.users.filter((user) => user?.id) : [];
    const templatePhoneId = req.body?.templatePhoneId;

    if (users.length === 0) {
      res.status(400).json({ error: "users must be a non-empty array." });
      return;
    }

    const invalidUser = users.find((user) => !user?.id || !user?.name);
    if (invalidUser) {
      res.status(400).json({ error: "Each user entry must include id and name." });
      return;
    }

    if (!templatePhoneId) {
      res.status(400).json({ error: "templatePhoneId is required." });
      return;
    }

    try {
      const results = await buildPhones({ ...credentials, users, templatePhoneId });
      res.status(200).json({ results });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });


  router.post("/api/genesys/users/bulk-role-assign", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.filter(Boolean) : [];
    const roleId = req.body?.roleId;
    const divisionId = req.body?.divisionId;

    if (userIds.length === 0) {
      res.status(400).json({ error: "userIds must be a non-empty array." });
      return;
    }

    if (!roleId || !divisionId) {
      res.status(400).json({ error: "roleId and divisionId are required." });
      return;
    }

    try {
      const results = await assignUsersToRoleDivision({
        ...credentials,
        userIds,
        roleId,
        divisionId,
      });
      res.status(200).json({ results });
    } catch (error) {
      console.error("[genesys] bulk role assignment failed", {
        region: credentials.region,
        status: error.status || 502,
        message: error.message,
        details: error.details || null,
      });
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });


  router.post("/api/genesys/users/bulk-skill-assign", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.filter(Boolean) : [];
    const skills = Array.isArray(req.body?.skills) ? req.body.skills.filter((skill) => skill?.id) : [];

    if (userIds.length === 0) {
      res.status(400).json({ error: "userIds must be a non-empty array." });
      return;
    }

    if (skills.length === 0) {
      res.status(400).json({ error: "skills must be a non-empty array." });
      return;
    }

    try {
      const results = await assignRoutingSkillsToUsers({
        ...credentials,
        userIds,
        skills,
      });
      res.status(200).json({ results });
    } catch (error) {
      console.error("[genesys] bulk skill assignment failed", {
        region: credentials.region,
        status: error.status || 502,
        message: error.message,
        details: error.details || null,
      });
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });


  router.get("/api/config/schedule-templates", async (_req, res) => {
    try {
      const content = await readFile(scheduleTemplatesPath, "utf8");
      res.status(200).json({ catalog: JSON.parse(content) });
    } catch (error) {
      res.status(500).json({
        error: error.message || "Failed to load schedule templates.",
      });
    }
  });


  router.post("/api/genesys/master-admin-role", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const roleName = req.body?.roleName;
    const description = req.body?.description;

    if (!String(roleName || "").trim()) {
      res.status(400).json({ error: "roleName is required." });
      return;
    }

    try {
      const role = await createMasterAdminRole({
        ...credentials,
        roleName,
        description,
      });
      res.status(200).json({ role });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });


  router.get("/api/genesys/conversations/:conversationId", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const { conversationId } = req.params;
    if (!conversationId) {
      res.status(400).json({ error: "conversationId is required." });
      return;
    }

    try {
      const conversation = await getConversation({ ...credentials, conversationId });
      res.status(200).json({ conversation });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/flow-executions", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const conversationId = req.body?.conversationId;
    if (!conversationId) {
      res.status(400).json({ error: "conversationId is required." });
      return;
    }

    try {
      const executions = await getFlowExecutions({ ...credentials, conversationId });
      res.status(200).json({ executions, conversationId });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/flow-executions/:instanceId/download", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const instanceId = String(req.params.instanceId || "").trim();
    if (!instanceId) {
      res.status(400).json({ error: "instanceId is required." });
      return;
    }

    try {
      const { document, downloadMeta } = await downloadFlowExecution({
        ...credentials,
        instanceId,
      });
      const model = parseExecutionJson(document, {
        conversationId: String(req.body?.conversationId || "").trim(),
        instanceId,
        flowName: String(req.body?.flowName || "").trim(),
        flowType: String(req.body?.flowType || "").trim(),
        flowVersion: String(req.body?.flowVersion || "").trim(),
      });

      if (!model.summary.actionsExecuted) {
        console.warn("[flow-execution] parsed zero actions", {
          instanceId,
          downloadMeta,
          parseMeta: model.meta,
        });
      }

      res.status(200).json({ model, instanceId, downloadMeta, parseMeta: model.meta });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
        source: error.details ? "genesys" : "internal",
      });
    }
  });

  router.post("/api/genesys/call-spoof", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const phoneNumber = String(req.body?.phoneNumber || "").trim();
    if (!phoneNumber) {
      res.status(400).json({ error: "phoneNumber is required." });
      return;
    }

    try {
      const call = await spoofOutboundCall({
        ...credentials,
        phoneNumber,
        callerId: req.body?.callerId,
        callerIdName: req.body?.callerIdName,
      });
      res.status(200).json({ call });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/call-spoof/inbound", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const inboundDnis = String(req.body?.inboundDnis || "").trim();
    if (!inboundDnis) {
      res.status(400).json({ error: "inboundDnis is required." });
      return;
    }

    const customAttributes =
      req.body?.customAttributes && typeof req.body.customAttributes === "object"
        ? req.body.customAttributes
        : {};

    try {
      const call = await spoofInboundCall({
        ...credentials,
        callUserId: req.body?.callUserId,
        inboundDnis,
        callerId: req.body?.callerId,
        callerIdName: req.body?.callerIdName,
        uuiData: req.body?.uuiData,
        callDateTime: req.body?.callDateTime,
        callTimeZone: req.body?.callTimeZone,
        description: req.body?.description,
        customAttributes,
      });
      res.status(200).json({ call });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.get("/api/genesys/bot-flows", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    try {
      const flows = await getBotFlows(credentials);
      res.status(200).json({ flows });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.get("/api/genesys/bot-flows/:flowId/utterances", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const { flowId } = req.params;
    if (!flowId) {
      res.status(400).json({ error: "flowId is required." });
      return;
    }

    try {
      const payload = await getBotUtterances({
        ...credentials,
        flowId,
        filters: {
          sessionId: req.query?.sessionId,
          askActionId: req.query?.askActionId,
          askActionResults: req.query?.askActionResults,
          pageNumber: req.query?.pageNumber,
        },
      });
      res.status(200).json(payload);
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.get("/api/genesys/bot-flows/:flowId/versions/:versionId/health", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const { flowId, versionId } = req.params;
    if (!flowId || !versionId) {
      res.status(400).json({ error: "flowId and versionId are required." });
      return;
    }

    try {
      const health = await getIntentHealth({ ...credentials, flowId, versionId });
      res.status(200).json({ health });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/schedules/load", async (req, res) => {
    const credentials = requireCredentials(req, res);
    if (!credentials) {
      return;
    }

    const schedules = Array.isArray(req.body?.schedules) ? req.body.schedules : [];

    if (schedules.length === 0) {
      res.status(400).json({ error: "schedules must be a non-empty array." });
      return;
    }

    const invalidSchedule = schedules.find(
      (schedule) =>
        !schedule?.scheduleKey ||
        !schedule?.name ||
        !schedule?.division?.id ||
        !schedule?.start ||
        !schedule?.end
    );
    if (invalidSchedule) {
      res.status(400).json({
        error: "Each schedule must include scheduleKey, name, division.id, start, and end.",
      });
      return;
    }

    try {
      const results = await loadSchedules({ ...credentials, schedules });
      res.status(200).json({ results });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });


  const loadConfiguredAuthorizedOrganizations = () => {
    const raw = process.env.GENESYS_AUTHORIZED_ORGS || "";

    if (!raw.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((entry) => entry?.id)
        .map((entry) => ({
          id: String(entry.id).trim(),
          name: entry.name || entry.id,
          source: "configured",
        }));
    } catch {
      const ids = raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const names = (process.env.GENESYS_AUTHORIZED_ORG_NAMES || "")
        .split(",")
        .map((entry) => entry.trim());

      return ids.map((id, index) => ({
        id,
        name: names[index] || id,
        source: "configured",
      }));
    }
  };

  const normalizeTrustorOrganization = (trustor) => {
    const id = trustor?.id || trustor?.organization?.id;

    if (!id || trustor?.enabled === false) {
      return null;
    }

    return {
      id,
      name: trustor?.organization?.name || trustor?.name || id,
      source: "trustor",
    };
  };

  const enrichTrustorOrganizations = async (credentials, trustors) => {
    const normalized = trustors.map(normalizeTrustorOrganization).filter(Boolean);
    const missingNames = normalized.filter(
      (entry) => entry.name === entry.id || !entry.name || entry.name === "Use organization ID"
    );

    if (!missingNames.length) {
      return normalized;
    }

    const enriched = await Promise.all(
      normalized.map(async (entry) => {
        if (!missingNames.some((candidate) => candidate.id === entry.id)) {
          return entry;
        }

        try {
          const trustor = await getOrgauthorizationTrustor({
            ...credentials,
            trustorOrgId: entry.id,
          });

          return normalizeTrustorOrganization(trustor) || entry;
        } catch {
          return entry;
        }
      })
    );

    return enriched;
  };

  const loadAccessibleOrganizations = async (credentials) => {
    const currentOrganization = await getOrganizationMe(credentials);
    let trustors = [];
    let trustorsError = null;

    try {
      trustors = await getOrgauthorizationTrustors(credentials);
    } catch (error) {
      trustorsError = error.message || "Unable to load authorized organizations.";
      console.warn("[genesys] trustors lookup failed", {
        region: credentials.region,
        message: trustorsError,
        details: error.details || null,
      });
    }

    const organizationsById = new Map();

    if (currentOrganization?.id) {
      organizationsById.set(currentOrganization.id, {
        id: currentOrganization.id,
        name: currentOrganization.name || currentOrganization.id,
        source: "current",
      });
    }

    loadConfiguredAuthorizedOrganizations().forEach((organization) => {
      if (!organizationsById.has(organization.id)) {
        organizationsById.set(organization.id, organization);
      }
    });

    const trustorOrganizations = await enrichTrustorOrganizations(credentials, trustors);
    trustorOrganizations.forEach((organization) => {
      if (!organizationsById.has(organization.id)) {
        organizationsById.set(organization.id, organization);
      }
    });

    const organizations = Array.from(organizationsById.values()).sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
    );

    const authorizedOrganizationCount = organizations.filter((organization) => organization.source !== "current").length;

    return {
      authorizedOrganizationCount,
      currentOrganizationId: currentOrganization?.id || "",
      organizations,
      trustorsError,
      trustorsLoaded: trustors.length,
    };
  };

  const handleAccessibleOrganizations = async (req, res) => {
    const credentials = requireCredentials(req, res);

    if (!credentials) {
      return;
    }

    try {
      const payload = await loadAccessibleOrganizations(credentials);
      res.status(200).json(payload);
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  };

  router.get("/api/genesys/accessible-organizations", handleAccessibleOrganizations);
  router.post("/api/genesys/accessible-organizations", handleAccessibleOrganizations);

  const getOAuthRedirectUri = () => {
    const port = process.env.PORT || 3000;
    return process.env.GENESYS_OAUTH_REDIRECT_URI || `http://localhost:${port}/oauth/callback.html`;
  };

  const buildOAuthScopes = (configuredScopes = "") => {
    const scopes = new Set(
      String(configuredScopes)
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter(Boolean)
    );

    scopes.add("organization-authorization:readonly");

    return [...scopes].join(" ");
  };

  router.get("/api/genesys/oauth/config", (req, res) => {
    const clientId = process.env.GENESYS_OAUTH_CLIENT_ID || "";

    if (!clientId) {
      res.status(503).json({
        error: "OAuth client is not configured. Set GENESYS_OAUTH_CLIENT_ID in the environment.",
      });
      return;
    }

    res.status(200).json({
      clientId,
      redirectUri: getOAuthRedirectUri(),
      scopes: buildOAuthScopes(process.env.GENESYS_OAUTH_SCOPES || ""),
      primaryOrgId: process.env.GENESYS_PRIMARY_ORG_ID || "",
    });
  });

  router.post("/api/genesys/oauth/token", async (req, res) => {
    const { region, code, codeVerifier, redirectUri } = req.body || {};
    const clientId = process.env.GENESYS_OAUTH_CLIENT_ID || "";

    if (!clientId) {
      res.status(503).json({ error: "OAuth client is not configured." });
      return;
    }

    if (!region || !code || !codeVerifier || !redirectUri) {
      res.status(400).json({ error: "region, code, codeVerifier, and redirectUri are required." });
      return;
    }

    const domain = await getGenesysDomainForRegion(region);

    if (!domain) {
      res.status(400).json({ error: `Unsupported Genesys region: ${region}` });
      return;
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: String(redirectUri),
      client_id: clientId,
      code_verifier: String(codeVerifier),
    });

    try {
      const response = await fetch(`https://login.${domain}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        res.status(response.status).json({
          error: payload.error_description || payload.error || "Token exchange failed.",
          details: payload,
        });
        return;
      }

      res.status(200).json({
        accessToken: payload.access_token,
        tokenType: payload.token_type,
        expiresIn: payload.expires_in,
      });
    } catch (error) {
      res.status(502).json({
        error: error.message || "Token exchange failed.",
      });
    }
  });

  router.get("/api/genesys/audits/service-mapping", async (req, res) => {
    const credentials = requireCredentials(req, res);

    if (!credentials) {
      return;
    }

    try {
      const serviceMapping = await getAuditServiceMapping(credentials);
      res.status(200).json({ serviceMapping });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/audits/query", async (req, res) => {
    const credentials = requireCredentials(req, res);

    if (!credentials) {
      return;
    }

    try {
      const query = await createAuditQuery({
        ...credentials,
        query: req.body?.query || req.body,
      });
      res.status(200).json({ query });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.get("/api/genesys/audits/query/:transactionId/status", async (req, res) => {
    const credentials = requireCredentials(req, res);

    if (!credentials) {
      return;
    }

    try {
      const status = await getAuditQueryStatus({
        ...credentials,
        transactionId: req.params.transactionId,
      });
      res.status(200).json({ status });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.get("/api/genesys/audits/query/:transactionId/results", async (req, res) => {
    const credentials = requireCredentials(req, res);

    if (!credentials) {
      return;
    }

    try {
      const results = await getAuditQueryResults({
        ...credentials,
        transactionId: req.params.transactionId,
        cursor: req.query.cursor || "",
      });
      res.status(200).json({ results });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.get("/api/genesys/notifications/availabletopics", async (req, res) => {
    const credentials = requireCredentials(req, res);

    if (!credentials) {
      return;
    }

    try {
      const topics = await getAvailableNotificationTopics(credentials);
      res.status(200).json(topics);
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/notifications/channels", async (req, res) => {
    const credentials = requireCredentials(req, res);

    if (!credentials) {
      return;
    }

    try {
      const channel = await createNotificationChannel(credentials);
      res.status(200).json({ channel });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.post("/api/genesys/notifications/channels/:channelId/subscriptions", async (req, res) => {
    const credentials = requireCredentials(req, res);

    if (!credentials) {
      return;
    }

    const topics = Array.isArray(req.body?.topics) ? req.body.topics : [];

    if (!topics.length) {
      res.status(400).json({ error: "At least one subscription topic is required." });
      return;
    }

    try {
      const subscription = await subscribeNotificationTopicsWithResults({
        ...credentials,
        channelId: req.params.channelId,
        topics,
      });
      res.status(200).json({ subscription });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  router.delete("/api/genesys/notifications/channels/:channelId", async (req, res) => {
    const credentials = requireCredentials(req, res);

    if (!credentials) {
      return;
    }

    try {
      await deleteNotificationChannel({
        ...credentials,
        channelId: req.params.channelId,
      });
      res.status(204).send();
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.message,
        details: error.details || null,
      });
    }
  });

  return router;
};

export { createGenesysRouter };
