import { filterUsersByIds, mapUsersForExportPayload, runExportJobViaJob } from "./export-job.js";

const collectUserExportViaJob = async ({
  jobType,
  credentials,
  loadSessionUsers,
  submitJob,
  getJob,
  getJobResults,
  userIds,
  onProgress,
  onResultsPage,
  onJobSubmitted,
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

  const targetUsers = filterUsersByIds(users, userIds);

  if (signal?.aborted) {
    return { rows: [], cancelled: true, totalUsers: targetUsers.length, userCache };
  }

  if (!targetUsers.length) {
    return { rows: [], cancelled: false, totalUsers: 0, userCache };
  }

  const { job, results, cancelled } = await runExportJobViaJob({
    ...credentials,
    type: jobType,
    payload: {
      users: mapUsersForExportPayload(targetUsers),
    },
    itemCount: targetUsers.length,
    onProgress: (jobSnapshot) => {
      onProgress?.({
        message: `Exporting ${targetUsers.length} user(s)...`,
        current: (Number(jobSnapshot?.completed) || 0) + (Number(jobSnapshot?.failed) || 0),
        total: Number(jobSnapshot?.total) || targetUsers.length,
      });
    },
    onResultsPage,
    onJobSubmitted,
    signal,
    submitJob,
    getJob,
    getJobResults,
  });

  onProgress?.({
    message: cancelled ? "Export cancelled." : "Finalizing export...",
    current: results.length,
    total: targetUsers.length,
  });

  return {
    rows: results,
    cancelled: Boolean(cancelled),
    totalUsers: targetUsers.length,
    userCache,
    job,
  };
};

const collectUserRoleMappingsViaJob = (options) =>
  collectUserExportViaJob({
    ...options,
    jobType: "user-role-export",
  });

const collectUserSkillMappingsViaJob = (options) =>
  collectUserExportViaJob({
    ...options,
    jobType: "user-skill-export",
  });

const collectSingleUserRoleMappingViaJob = (options) =>
  collectUserRoleMappingsViaJob({
    ...options,
    userIds: options.userId ? [options.userId] : options.userIds,
  });

const collectSingleUserSkillMappingViaJob = (options) =>
  collectUserSkillMappingsViaJob({
    ...options,
    userIds: options.userId ? [options.userId] : options.userIds,
  });

export {
  collectSingleUserRoleMappingViaJob,
  collectSingleUserSkillMappingViaJob,
  collectUserExportViaJob,
  collectUserRoleMappingsViaJob,
  collectUserSkillMappingsViaJob,
};
