const normalizeSkills = (skills) =>
  Array.isArray(skills)
    ? skills
        .map((skill) => ({
          id: String(skill?.id || "").trim(),
          proficiency: Number(skill?.proficiency),
        }))
        .filter((skill) => skill.id && Number.isFinite(skill.proficiency))
    : [];

const buildItems = (payload = {}) => {
  const userIds = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : [];
  const skills = normalizeSkills(payload.skills);

  if (userIds.length === 0) {
    throw new Error("userIds must be a non-empty array.");
  }

  if (skills.length === 0) {
    throw new Error("skills must be a non-empty array.");
  }

  return userIds.map((userId) => ({
    itemId: String(userId),
    payload: {
      userId: String(userId),
      skills,
    },
  }));
};

const processItem = async (item, ctx) => {
  const { apiClient } = ctx;
  const { userId, skills } = item.payload;

  return apiClient.patch(
    `/api/v2/users/${encodeURIComponent(userId)}/routingskills/bulk`,
    skills,
    {
      itemContext: {
        jobId: ctx.jobId,
        itemId: userId,
        workerId: ctx.workerId,
      },
    }
  );
};

const buildResults = (poolResults) =>
  poolResults.map((row) => ({
    userId: row.itemId,
    status: row.status,
    response: row.result || null,
    error: row.error || null,
    details: row.details || null,
    attempts: row.attempts,
  }));

export { buildItems, buildResults, processItem };
