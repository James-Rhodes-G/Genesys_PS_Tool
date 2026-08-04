const SESSION_ROW_PAGE_SIZE = 100;
const SESSION_OFFLOAD_THRESHOLD = 200;

const parseJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || fallbackMessage);
    error.payload = payload;
    throw error;
  }

  return payload;
};

const bindSession = async ({ orgId, orgName, region }) =>
  parseJsonResponse(
    await fetch("/api/session/bind", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orgId, orgName, region }),
    }),
    "Failed to bind session."
  );

const clearSession = async () =>
  parseJsonResponse(
    await fetch("/api/session/clear", {
      method: "POST",
      credentials: "same-origin",
    }),
    "Failed to clear session."
  );

const serializeExportMeta = (exportMeta) => ({
  resultId: exportMeta.resultId,
  title: exportMeta.title,
  status: exportMeta.status,
  exportType: exportMeta.exportType,
  kind: exportMeta.kind,
  editMode: exportMeta.editMode,
  editable: exportMeta.editable,
  hideActions: exportMeta.hideActions,
  selectedColumnKeys: exportMeta.selectedColumnKeys || [],
  availableColumns: (exportMeta.availableColumns || []).map((column) => ({
    key: column.key,
    header: column.header,
  })),
});

const saveExportToSession = async ({ exportId, exportMeta, rows }) =>
  parseJsonResponse(
    await fetch("/api/session/exports", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        exportId,
        exportType: exportMeta?.exportType || "",
        title: exportMeta?.title || "",
        status: exportMeta?.status || "",
        meta: serializeExportMeta(exportMeta),
        rows,
      }),
    }),
    "Failed to save export to session."
  );

const fetchExportRows = async ({ exportId, offset = 0, limit = SESSION_ROW_PAGE_SIZE }) => {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });

  return parseJsonResponse(
    await fetch(`/api/session/exports/${encodeURIComponent(exportId)}/rows?${params.toString()}`, {
      method: "GET",
      credentials: "same-origin",
    }),
    "Failed to load export rows."
  );
};

const fetchAllExportRows = async ({ exportId }) =>
  parseJsonResponse(
    await fetch(`/api/session/exports/${encodeURIComponent(exportId)}/rows/all`, {
      method: "GET",
      credentials: "same-origin",
    }),
    "Failed to load export rows."
  );

const fetchUserSyncStatus = async () =>
  parseJsonResponse(
    await fetch("/api/session/users/status", {
      method: "GET",
      credentials: "same-origin",
    }),
    "Failed to read user sync status."
  );

const syncSessionUsers = async ({ region, token, force = false }) =>
  parseJsonResponse(
    await fetch("/api/session/users/sync", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ region, token, force }),
    }),
    "Failed to sync users."
  );

const fetchCachedUsers = async () =>
  parseJsonResponse(
    await fetch("/api/session/users", {
      method: "GET",
      credentials: "same-origin",
    }),
    "Failed to load cached users."
  );

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatUserCacheTimestamp = (syncedAt) => {
  const value = Number(syncedAt);
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatUserCacheStatusSuffix = (cache = {}) => {
  const timestamp = formatUserCacheTimestamp(cache.syncedAt);
  if (!timestamp) {
    return "";
  }

  return cache.fromCache ? ` — cached ${timestamp}` : ` — synced ${timestamp}`;
};

const appendUserCacheStatus = (status, cache) => {
  const suffix = formatUserCacheStatusSuffix(cache);
  return suffix ? `${status}${suffix}` : status;
};

const ensureSessionUsersSynced = async ({
  region,
  token,
  force = false,
  onProgress,
  signal,
} = {}) => {
  if (!region || !token) {
    throw new Error("Both region and token are required.");
  }

  const initialStatus = await fetchUserSyncStatus();
  const cacheIsCurrent =
    initialStatus.sync?.status === "ready" &&
    initialStatus.sync?.expandProfile === initialStatus.expandProfile;

  if (cacheIsCurrent && !force) {
    const cachedAt = formatUserCacheTimestamp(initialStatus.sync.syncedAt);
    onProgress?.({
      message: cachedAt
        ? `Using cached users (${initialStatus.sync.userCount || 0}) — cached ${cachedAt}`
        : `Using cached users (${initialStatus.sync.userCount || 0}).`,
      current: initialStatus.sync.userCount || 0,
      total: initialStatus.sync.userCount || 0,
    });
    return { ...initialStatus.sync, fromCache: true };
  }

  let syncPromise = null;
  if (initialStatus.sync?.status !== "syncing") {
    syncPromise = syncSessionUsers({ region, token, force });
  }

  while (true) {
    if (signal?.aborted) {
      throw new DOMException("User sync aborted.", "AbortError");
    }

    const statusPayload = await fetchUserSyncStatus();
    const sync = statusPayload.sync || {};
    const total = Number(sync.userCount || sync.syncedCount || 0);
    const current = Number(sync.syncedCount || 0);

    if (sync.status === "syncing") {
      onProgress?.({
        message:
          total > 0
            ? `Syncing users... ${current} / ${total}`
            : `Syncing users... ${current}`,
        current,
        total,
      });
    } else if (sync.status === "ready") {
      const syncedAt = formatUserCacheTimestamp(sync.syncedAt);
      onProgress?.({
        message: syncedAt
          ? `Synced ${sync.userCount || current} users — synced ${syncedAt}`
          : `Synced ${sync.userCount || current} users.`,
        current: sync.userCount || current,
        total: sync.userCount || current,
      });
      break;
    } else if (sync.status === "error") {
      throw new Error(sync.errorMessage || "User sync failed.");
    } else {
      onProgress?.({
        message: 'Fetching "/api/v2/users"...',
        current: 0,
        total: 0,
      });
    }

    await wait(400);
  }

  if (syncPromise) {
    await syncPromise;
  }

  const finalStatus = await fetchUserSyncStatus();
  return { ...(finalStatus.sync || {}), fromCache: false };
};

const loadSessionUsers = async ({
  region,
  token,
  force = false,
  onProgress,
  signal,
} = {}) => {
  const sync = await ensureSessionUsersSynced({
    region,
    token,
    force,
    onProgress,
    signal,
  });
  const payload = await fetchCachedUsers();

  return {
    users: payload.users || [],
    cache: {
      fromCache: Boolean(sync?.fromCache),
      syncedAt: sync?.syncedAt ?? payload.sync?.syncedAt ?? null,
      userCount: sync?.userCount ?? payload.users?.length ?? 0,
    },
  };
};

export {
  SESSION_OFFLOAD_THRESHOLD,
  SESSION_ROW_PAGE_SIZE,
  appendUserCacheStatus,
  bindSession,
  clearSession,
  ensureSessionUsersSynced,
  fetchAllExportRows,
  fetchCachedUsers,
  fetchExportRows,
  fetchUserSyncStatus,
  formatUserCacheTimestamp,
  loadSessionUsers,
  saveExportToSession,
  serializeExportMeta,
  syncSessionUsers,
};
