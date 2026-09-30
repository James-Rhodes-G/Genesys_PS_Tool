const normalizeExportUsers = (payload = {}) => {
  if (Array.isArray(payload.users) && payload.users.length > 0) {
    return payload.users
      .map((user) => ({
        id: String(user?.id || "").trim(),
        name: String(user?.name || "").trim(),
        userName: String(user?.userName || user?.username || "").trim(),
        skills: user?.skills ?? user?.routingSkills ?? null,
      }))
      .filter((user) => user.id);
  }

  const userIds = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : [];
  return userIds.map((userId) => ({
    id: String(userId),
    name: "",
    userName: "",
    skills: null,
  }));
};

const buildUserExportItems = (payload = {}) => {
  const users = normalizeExportUsers(payload);

  if (users.length === 0) {
    throw new Error("users or userIds must be a non-empty array.");
  }

  return users.map((user) => ({
    itemId: user.id,
    payload: user,
  }));
};

export { buildUserExportItems, normalizeExportUsers };
