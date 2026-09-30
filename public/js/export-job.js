const TERMINAL_JOB_STATUSES = new Set(["completed", "completed_with_errors", "failed", "cancelled"]);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runExportJobViaJob = async ({
  region,
  token,
  type,
  payload,
  itemCount = 0,
  resultsPageSize = 100,
  pollIntervalMs = 750,
  onProgress,
  onResultsPage,
  onJobSubmitted,
  signal,
  submitJob,
  getJob,
  getJobResults,
}) => {
  const submission = await submitJob({
    region,
    token,
    type,
    payload,
  });

  if (typeof onJobSubmitted === "function") {
    onJobSubmitted(submission);
  }

  const jobId = submission.jobId;
  let fetchedOffset = 0;
  const allResults = [];

  const fetchAvailablePages = async (jobSnapshot) => {
    const availableCount =
      Number(jobSnapshot?.resultsCount) ||
      Number(jobSnapshot?.completed || 0) + Number(jobSnapshot?.failed || 0);

    while (fetchedOffset < availableCount) {
      const page = await getJobResults({
        region,
        token,
        jobId,
        offset: fetchedOffset,
        limit: resultsPageSize,
      });

      const pageRows = page?.results || [];
      if (!pageRows.length) {
        break;
      }

      allResults.push(...pageRows);
      if (typeof onResultsPage === "function") {
        await onResultsPage({
          rows: pageRows,
          offset: fetchedOffset,
          totalAvailable: availableCount,
          partial: Boolean(page.partial),
          job: jobSnapshot,
        });
      }

      fetchedOffset += pageRows.length;

      if (pageRows.length < resultsPageSize) {
        break;
      }
    }
  };

  while (true) {
    if (signal?.aborted) {
      const error = new Error("Export job polling cancelled.");
      error.name = "AbortError";
      throw error;
    }

    const job = await getJob({ region, token, jobId });
    if (typeof onProgress === "function") {
      onProgress(job);
    }

    await fetchAvailablePages(job);

    if (TERMINAL_JOB_STATUSES.has(job.status)) {
      await fetchAvailablePages(job);
      return {
        job,
        results: allResults,
        cancelled: job.status === "cancelled" || Boolean(signal?.aborted),
      };
    }

    await wait(pollIntervalMs);
  }
};

const mapUsersForExportPayload = (users) =>
  (users || [])
    .filter((user) => user?.id)
    .map((user) => ({
      id: user.id,
      name: user.name || "",
      userName: user.userName || user.username || "",
      skills: user.skills ?? user.routingSkills ?? undefined,
    }));

const filterUsersByIds = (users, userIds) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return users || [];
  }

  const allowed = new Set(userIds.map((id) => String(id)));
  return (users || []).filter((user) => allowed.has(String(user.id)));
};

export { filterUsersByIds, mapUsersForExportPayload, runExportJobViaJob };
