import { sanitizePhoneTemplateForCreate } from "../../genesys.js";

const templatePromises = new Map();

const templateCacheKey = (jobId, templatePhoneId) => `${jobId}:${templatePhoneId}`;

const fetchTemplateForJob = (jobId, templatePhoneId, apiClient) => {
  const key = templateCacheKey(jobId, templatePhoneId);
  if (!templatePromises.has(key)) {
    templatePromises.set(
      key,
      apiClient.get(`/api/v2/telephony/providers/edges/phones/${encodeURIComponent(templatePhoneId)}`)
    );
  }

  return templatePromises.get(key);
};

const cleanupJob = (jobId) => {
  for (const key of templatePromises.keys()) {
    if (key.startsWith(`${jobId}:`)) {
      templatePromises.delete(key);
    }
  }
};

const normalizeUsers = (users) =>
  Array.isArray(users)
    ? users
        .map((user) => ({
          id: String(user?.id || "").trim(),
          name: String(user?.name || "").trim(),
          userName: String(user?.userName || user?.username || "").trim(),
        }))
        .filter((user) => user.id)
    : [];

const buildItems = (payload = {}) => {
  const users = normalizeUsers(payload.users);
  const templatePhoneId = String(payload.templatePhoneId || "").trim();

  if (users.length === 0) {
    throw new Error("users must be a non-empty array.");
  }

  if (!templatePhoneId) {
    throw new Error("templatePhoneId is required.");
  }

  return users.map((user) => ({
    itemId: user.id,
    payload: {
      user,
      templatePhoneId,
    },
  }));
};

const processItem = async (item, ctx) => {
  const { apiClient } = ctx;
  const { user, templatePhoneId } = item.payload;
  const itemContext = {
    jobId: ctx.jobId,
    itemId: user.id,
    workerId: ctx.workerId,
  };

  const templatePhone = await fetchTemplateForJob(ctx.jobId, templatePhoneId, apiClient);
  const body = sanitizePhoneTemplateForCreate(templatePhone, user);

  const createdPhone = await apiClient.post("/api/v2/telephony/providers/edges/phones", body, {
    itemContext,
  });

  return {
    userId: user.id,
    phoneId: createdPhone?.id || "",
    phoneName: createdPhone?.name || body.name || "",
  };
};

const buildResults = (poolResults) =>
  poolResults.map((row) => ({
    userId: row.itemId,
    phoneId: row.result?.phoneId || "",
    phoneName: row.result?.phoneName || "",
    status: row.status,
    error: row.error || "",
    details: row.details || null,
    attempts: row.attempts,
  }));

export { buildItems, buildResults, cleanupJob, processItem };
