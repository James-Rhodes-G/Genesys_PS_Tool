const buildItems = (payload = {}) => {
  const conversationIds = Array.isArray(payload.conversationIds)
    ? payload.conversationIds.filter(Boolean)
    : [];

  if (conversationIds.length === 0) {
    throw new Error("conversationIds must be a non-empty array.");
  }

  return conversationIds.map((conversationId) => ({
    itemId: String(conversationId),
    payload: { conversationId: String(conversationId) },
  }));
};

const processItem = async (item, ctx) => {
  const { apiClient } = ctx;
  const { conversationId } = item.payload;
  const itemContext = {
    jobId: ctx.jobId,
    itemId: conversationId,
    workerId: ctx.workerId,
  };

  const response = await apiClient.post(
    `/api/v2/conversations/${encodeURIComponent(conversationId)}/disconnect`,
    {},
    { itemContext }
  );

  return { conversationId, response: response || null };
};

const buildResults = (poolResults) =>
  poolResults.map((row) => ({
    conversationId: row.itemId,
    status: row.status,
    error: row.error || "",
    details: row.details || null,
    attempts: row.attempts,
  }));

export { buildItems, buildResults, processItem };
