import { formatUserSkillAssignments, normalizeRoutingSkills } from "../../genesys.js";
import { buildUserExportItems } from "./export-user-utils.js";

const buildItems = (payload = {}) => buildUserExportItems(payload);

const resolveSkillsFromUser = (user) => {
  if (user?.skills != null) {
    return normalizeRoutingSkills(user.skills);
  }

  return null;
};

const processItem = async (item, ctx) => {
  const { apiClient } = ctx;
  const user = item.payload;
  const userId = user.id;
  const itemContext = {
    jobId: ctx.jobId,
    itemId: userId,
    workerId: ctx.workerId,
  };

  let skills = resolveSkillsFromUser(user);

  if (skills == null) {
    const response = await apiClient.get(`/api/v2/users/${encodeURIComponent(userId)}/routingskills`, {
      itemContext,
    });
    skills = normalizeRoutingSkills(response);
  }

  return {
    name: user.name || "",
    userName: user.userName || "",
    userId,
    skillAssignments: formatUserSkillAssignments(skills),
  };
};

const buildResults = (poolResults) =>
  poolResults.map((row) => ({
    name: row.result?.name || "",
    userName: row.result?.userName || "",
    userId: row.itemId,
    skillAssignments: row.result?.skillAssignments || "",
    status: row.status,
    error: row.error || "",
    details: row.details || null,
    attempts: row.attempts,
  }));

export { buildItems, buildResults, processItem };
