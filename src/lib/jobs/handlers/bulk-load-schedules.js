const normalizeSchedules = (schedules) =>
  Array.isArray(schedules)
    ? schedules
        .filter((schedule) => schedule?.scheduleKey)
        .map((schedule) => ({
          scheduleKey: String(schedule.scheduleKey),
          countryCode: schedule.countryCode || "",
          sourceName: schedule.sourceName || "",
          requestedName: schedule.requestedName || "",
          payload: (() => {
            const {
              scheduleKey: _scheduleKey,
              countryCode: _countryCode,
              sourceName: _sourceName,
              requestedName: _requestedName,
              ...body
            } = schedule;
            return body;
          })(),
        }))
    : [];

const buildItems = (payload = {}) => {
  const schedules = normalizeSchedules(payload.schedules);

  if (schedules.length === 0) {
    throw new Error("schedules must be a non-empty array.");
  }

  return schedules.map((schedule) => ({
    itemId: schedule.scheduleKey,
    payload: schedule,
  }));
};

const processItem = async (item, ctx) => {
  const { apiClient } = ctx;
  const { scheduleKey, countryCode, sourceName, requestedName, payload } = item.payload;
  const itemContext = {
    jobId: ctx.jobId,
    itemId: scheduleKey,
    workerId: ctx.workerId,
  };

  const createdSchedule = await apiClient.post("/api/v2/architect/schedules", payload, { itemContext });

  return {
    scheduleKey,
    countryCode,
    sourceName,
    requestedName: requestedName || payload.name || "",
    scheduleId: createdSchedule?.id || "",
    scheduleName: createdSchedule?.name || payload.name || "",
  };
};

const buildResults = (poolResults) =>
  poolResults.map((row) => ({
    scheduleKey: row.itemId,
    countryCode: row.result?.countryCode || "",
    sourceName: row.result?.sourceName || "",
    requestedName: row.result?.requestedName || "",
    scheduleId: row.result?.scheduleId || "",
    scheduleName: row.result?.scheduleName || "",
    status: row.status,
    error: row.error || "",
    details: row.details || null,
    attempts: row.attempts,
  }));

export { buildItems, buildResults, processItem };
