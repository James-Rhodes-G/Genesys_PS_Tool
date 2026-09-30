const buildItems = (payload = {}) => {
  const phoneIds = Array.isArray(payload.phoneIds) ? payload.phoneIds.filter(Boolean) : [];

  if (phoneIds.length === 0) {
    throw new Error("phoneIds must be a non-empty array.");
  }

  return phoneIds.map((phoneId) => ({
    itemId: String(phoneId),
    payload: { phoneId: String(phoneId) },
  }));
};

const processItem = async (item, ctx) => {
  const { apiClient } = ctx;
  const { phoneId } = item.payload;
  const itemContext = {
    jobId: ctx.jobId,
    itemId: phoneId,
    workerId: ctx.workerId,
  };

  let phoneName = phoneId;
  try {
    const phone = await apiClient.get(
      `/api/v2/telephony/providers/edges/phones/${encodeURIComponent(phoneId)}`,
      { itemContext }
    );
    phoneName = phone?.name || phoneId;
  } catch {
    phoneName = phoneId;
  }

  await apiClient.delete(
    `/api/v2/telephony/providers/edges/phones/${encodeURIComponent(phoneId)}`,
    { itemContext }
  );

  return { phoneId, phoneName };
};

const buildResults = (poolResults) =>
  poolResults.map((row) => ({
    phoneId: row.itemId,
    phoneName: row.result?.phoneName || "",
    status: row.status,
    error: row.error || "",
    details: row.details || null,
    attempts: row.attempts,
  }));

export { buildItems, buildResults, processItem };
