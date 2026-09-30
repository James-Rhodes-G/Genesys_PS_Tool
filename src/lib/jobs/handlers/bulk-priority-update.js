const normalizeUpdates = (updates) =>
  Array.isArray(updates)
    ? updates
        .map((entry) => ({
          conversationId: String(entry?.conversationId || "").trim(),
          priority: Number(entry?.priority),
        }))
        .filter((entry) => entry.conversationId && Number.isFinite(entry.priority))
    : [];

const buildItems = (payload = {}) => {
  const updates = normalizeUpdates(payload.updates);

  if (updates.length === 0) {
    throw new Error("updates must include conversationId and priority.");
  }

  return updates.map((entry) => ({
    itemId: entry.conversationId,
    payload: entry,
  }));
};

const processItem = async (item, ctx) => {
  const { apiClient } = ctx;
  const { conversationId, priority } = item.payload;
  const itemContext = {
    jobId: ctx.jobId,
    itemId: conversationId,
    workerId: ctx.workerId,
  };

  const response = await apiClient.patch(
    `/api/v2/routing/conversations/${encodeURIComponent(conversationId)}`,
    { priority },
    { itemContext }
  );

  return { conversationId, priority, response: response || null };
};

const buildResults = (poolResults) =>
  poolResults.map((row) => ({
    conversationId: row.itemId,
    priority: row.result?.priority ?? "",
    status: row.status,
    error: row.error || "",
    details: row.details || null,
    attempts: row.attempts,
  }));

export { buildItems, buildResults, processItem };
