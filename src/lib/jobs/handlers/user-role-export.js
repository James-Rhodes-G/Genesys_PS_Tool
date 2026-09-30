import { formatUserRoleAssignments } from "../../genesys.js";
import { buildUserExportItems } from "./export-user-utils.js";

const buildItems = (payload = {}) => buildUserExportItems(payload);

const processItem = async (item, ctx) => {
  const { apiClient } = ctx;
  const { id: userId, name, userName } = item.payload;
  const itemContext = {
    jobId: ctx.jobId,
    itemId: userId,
    workerId: ctx.workerId,
  };

  const subject = await apiClient.get(
    `/api/v2/authorization/subjects/${encodeURIComponent(userId)}`,
    { itemContext }
  );

  const grants = Array.isArray(subject?.grants) ? subject.grants : [];

  return {
    name,
    userName,
    userId,
    roleAssignments: formatUserRoleAssignments(grants),
  };
};

const buildResults = (poolResults) =>
  poolResults.map((row) => ({
    name: row.result?.name || "",
    userName: row.result?.userName || "",
    userId: row.itemId,
    roleAssignments: row.result?.roleAssignments || "",
    status: row.status,
    error: row.error || "",
    details: row.details || null,
    attempts: row.attempts,
  }));

export { buildItems, buildResults, processItem };
