const formatUserRoleAssignments = (grants) => {
  if (!Array.isArray(grants) || grants.length === 0) {
    return "";
  }

  return grants
    .map((grant) => {
      const roleName = grant?.role?.name || grant?.role?.id || "";
      const divisionName = grant?.division?.name || "All";
      return roleName ? `${roleName}:${divisionName}` : "";
    })
    .filter(Boolean)
    .join(" | ");
};

const collectUserRoleMappings = async ({
  credentials,
  loadSessionUsers,
  getAuthorizationSubject,
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
      message: `Fetching role assignments for ${displayName}...`,
      current: Math.min(index + 1, total),
      total,
    });

    try {
      const subject = await getAuthorizationSubject({
        ...credentials,
        subjectId: user.id,
      });

      if (signal?.aborted) {
        break;
      }

      rows.push({
        name: user.name || "",
        userName: user.username || user.userName || "",
        userId: user.id || "",
        roleAssignments: formatUserRoleAssignments(subject?.grants),
        status: "success",
        error: "",
      });
    } catch (error) {
      if (signal?.aborted) {
        break;
      }

      rows.push({
        name: user.name || "",
        userName: user.username || user.userName || "",
        userId: user.id || "",
        roleAssignments: "",
        status: "failed",
        error: error.message || "Role lookup failed",
      });
    }
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

export { collectUserRoleMappings, formatUserRoleAssignments };
