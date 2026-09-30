const buildItems = (payload = {}) => {
  const userIds = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : [];
  const roleAssignments = Array.isArray(payload.roleAssignments) ? payload.roleAssignments : [];

  if (userIds.length === 0) {
    throw new Error("userIds must be a non-empty array.");
  }

  if (roleAssignments.length === 0) {
    throw new Error("roleAssignments must be a non-empty array.");
  }

  const items = [];

  roleAssignments.forEach((assignment) => {
    const roleId = String(assignment?.roleId || "").trim();
    const divisionId = String(assignment?.divisionId || "").trim();

    if (!roleId || !divisionId) {
      return;
    }

    userIds.forEach((userId) => {
      const normalizedUserId = String(userId);
      items.push({
        itemId: `${normalizedUserId}:${roleId}:${divisionId}`,
        payload: {
          userId: normalizedUserId,
          roleId,
          divisionId,
        },
      });
    });
  });

  if (items.length === 0) {
    throw new Error("roleAssignments must include roleId and divisionId.");
  }

  return items;
};

const processItem = async (item, ctx) => {
  const { apiClient } = ctx;
  const { userId, roleId, divisionId } = item.payload;
  const itemContext = {
    jobId: ctx.jobId,
    itemId: item.itemId,
    workerId: ctx.workerId,
  };

  const response = await apiClient.post(
    `/api/v2/authorization/roles/${encodeURIComponent(roleId)}`,
    {
      divisionIds: [divisionId],
      subjectIds: [userId],
    },
    { itemContext }
  );

  return { userId, roleId, divisionId, response: response || null };
};

const buildResults = (poolResults) =>
  poolResults.map((row) => ({
    userId: row.result?.userId || row.itemId.split(":")[0] || row.itemId,
    roleId: row.result?.roleId || "",
    divisionId: row.result?.divisionId || "",
    status: row.status,
    error: row.error || "",
    details: row.details || null,
    attempts: row.attempts,
  }));

export { buildItems, buildResults, processItem };
