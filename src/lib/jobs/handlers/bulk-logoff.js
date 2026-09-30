const buildItems = (payload = {}) => {
  const userIds = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : [];

  if (userIds.length === 0) {
    throw new Error("userIds must be a non-empty array.");
  }

  return userIds.map((userId) => ({
    itemId: String(userId),
    payload: { userId: String(userId) },
  }));
};

const processItem = async (item, ctx) => {
  const { apiClient } = ctx;
  const { userId } = item.payload;
  const itemContext = {
    jobId: ctx.jobId,
    itemId: userId,
    workerId: ctx.workerId,
  };

  await apiClient.delete(`/api/v2/apps/users/${encodeURIComponent(userId)}/logout`, {
    itemContext,
  });

  return { userId };
};

const buildResults = (poolResults) =>
  poolResults.map((row) => ({
    userId: row.itemId,
    status: row.status,
    error: row.error || "",
    details: row.details || null,
    attempts: row.attempts,
  }));

export { buildItems, buildResults, processItem };
