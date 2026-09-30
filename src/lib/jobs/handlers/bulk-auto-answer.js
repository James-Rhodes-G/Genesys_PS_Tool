const buildItems = (payload = {}) => {
  const userIds = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : [];
  const acdAutoAnswer = Boolean(payload.acdAutoAnswer);

  if (userIds.length === 0) {
    throw new Error("userIds must be a non-empty array.");
  }

  return userIds.map((userId) => ({
    itemId: String(userId),
    payload: { userId: String(userId), acdAutoAnswer },
  }));
};

const processItem = async (item, ctx) => {
  const { apiClient } = ctx;
  const { userId, acdAutoAnswer } = item.payload;
  const itemContext = {
    jobId: ctx.jobId,
    itemId: userId,
    workerId: ctx.workerId,
  };

  const response = await apiClient.patch(
    `/api/v2/users/${encodeURIComponent(userId)}`,
    { acdAutoAnswer },
    { itemContext }
  );

  return { userId, acdAutoAnswer, response: response || null };
};

const buildResults = (poolResults) =>
  poolResults.map((row) => ({
    userId: row.itemId,
    status: row.status,
    acdAutoAnswer: row.result?.acdAutoAnswer ?? null,
    error: row.error || "",
    details: row.details || null,
    attempts: row.attempts,
  }));

export { buildItems, buildResults, processItem };
