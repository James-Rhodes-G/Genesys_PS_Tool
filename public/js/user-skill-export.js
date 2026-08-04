const normalizeRoutingSkills = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.entities)) {
    return payload.entities;
  }

  return [];
};

const getSkillsFromUser = (user) => normalizeRoutingSkills(user?.skills ?? user?.routingSkills);

const formatUserSkillAssignments = (skills) => {
  const normalizedSkills = normalizeRoutingSkills(skills);

  if (normalizedSkills.length === 0) {
    return "";
  }

  return normalizedSkills
    .map((skill) => {
      const skillName = skill?.name || skill?.id || "";
      const proficiency = skill?.proficiency ?? "";
      return skillName ? `${skillName}:${proficiency}` : "";
    })
    .filter(Boolean)
    .join(" | ");
};

const collectUserSkillMappings = async ({
  credentials,
  loadSessionUsers,
  onProgress,
  signal,
  forceRefresh = false,
}) => {
  onProgress?.({
    message: 'Fetching "/api/v2/users"...',
    current: 0,
    total: 0,
  });

  let users = [];
  let userCache = null;

  try {
    ({ users, cache: userCache } = await loadSessionUsers({
      ...credentials,
      onProgress,
      signal,
      force: Boolean(forceRefresh),
    }));
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError") {
      return { rows: [], cancelled: true, totalUsers: 0, userCache };
    }

    throw error;
  }

  if (signal?.aborted) {
    return { rows: [], cancelled: true, totalUsers: users.length, userCache };
  }

  const total = users.length;
  const rows = [];

  for (let index = 0; index < users.length; index += 1) {
    if (signal?.aborted) {
      break;
    }

    const user = users[index];
    const displayName = user.name || user.userName || user.username || user.id || "user";

    onProgress?.({
      message: `Building skill assignments for ${displayName}...`,
      current: Math.min(index + 1, total),
      total,
    });

    rows.push({
      name: user.name || "",
      userName: user.username || user.userName || "",
      userId: user.id || "",
      skillAssignments: formatUserSkillAssignments(getSkillsFromUser(user)),
      status: "success",
      error: "",
    });
  }

  onProgress?.({
    message: signal?.aborted ? "Export cancelled." : "Finalizing export...",
    current: rows.length,
    total,
  });

  return {
    rows,
    cancelled: Boolean(signal?.aborted),
    totalUsers: total,
    userCache,
  };
};

export {
  collectUserSkillMappings,
  formatUserSkillAssignments,
  getSkillsFromUser,
  normalizeRoutingSkills,
};
