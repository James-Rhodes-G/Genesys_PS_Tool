const normalizePasswordResets = (passwordResets) =>
  Array.isArray(passwordResets)
    ? passwordResets
        .map((entry) => ({
          userId: String(entry?.userId || "").trim(),
          newPassword: String(entry?.newPassword || ""),
        }))
        .filter((entry) => entry.userId && entry.newPassword)
    : [];

const buildItems = (payload = {}) => {
  const passwordResets = normalizePasswordResets(payload.passwordResets);

  if (passwordResets.length === 0) {
    throw new Error("passwordResets must include userId and newPassword.");
  }

  return passwordResets.map((entry) => ({
    itemId: entry.userId,
    payload: entry,
  }));
};

const processItem = async (item, ctx) => {
  const { apiClient } = ctx;
  const { userId, newPassword } = item.payload;
  const itemContext = {
    jobId: ctx.jobId,
    itemId: userId,
    workerId: ctx.workerId,
  };

  const response = await apiClient.post(
    `/api/v2/users/${encodeURIComponent(userId)}/password`,
    { newPassword },
    { itemContext }
  );

  return { userId, response: response || null };
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
