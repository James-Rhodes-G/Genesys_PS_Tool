import { paginateUsersExpanded, USERS_CACHE_EXPAND } from "./genesys.js";
import {
  clearCachedUsers,
  getCachedUsers,
  getUserSyncState,
  insertCachedUsers,
  setUserSyncState,
} from "../data/session-db.js";

const syncPromises = new Map();

const syncKey = (sessionId, orgId) => `${sessionId}:${orgId}`;

const syncSessionUsers = async ({
  db,
  sessionId,
  orgId,
  region,
  token,
  force = false,
}) => {
  const key = syncKey(sessionId, orgId);
  const existing = await getUserSyncState(db, { sessionId, orgId });

  if (existing?.status === "ready" && !force && existing.expandProfile === USERS_CACHE_EXPAND) {
    return existing;
  }

  if (syncPromises.has(key)) {
    return syncPromises.get(key);
  }

  const promise = (async () => {
    await setUserSyncState(db, {
      sessionId,
      orgId,
      status: "syncing",
      userCount: 0,
      syncedCount: 0,
      syncedAt: null,
      errorMessage: null,
      expandProfile: null,
    });
    await clearCachedUsers(db, { sessionId, orgId });

    try {
      let latestTotal = 0;

      const users = await paginateUsersExpanded({
        region,
        token,
        onPage: async ({ entities, pageNumber, pageCount, syncedCount, total }) => {
          latestTotal = total || syncedCount;
          await insertCachedUsers(db, {
            sessionId,
            orgId,
            users: entities,
          });
          await setUserSyncState(db, {
            sessionId,
            orgId,
            status: "syncing",
            userCount: latestTotal,
            syncedCount,
            syncedAt: null,
            errorMessage: null,
            expandProfile: null,
          });

          console.log("[user-cache] synced users page", {
            sessionId,
            orgId,
            pageNumber,
            pageCount,
            syncedCount,
            total: latestTotal,
          });
        },
      });

      await setUserSyncState(db, {
        sessionId,
        orgId,
        status: "ready",
        userCount: users.length,
        syncedCount: users.length,
        syncedAt: Date.now(),
        errorMessage: null,
        expandProfile: USERS_CACHE_EXPAND,
      });

      return getUserSyncState(db, { sessionId, orgId });
    } catch (error) {
      await setUserSyncState(db, {
        sessionId,
        orgId,
        status: "error",
        userCount: existing?.userCount || 0,
        syncedCount: existing?.syncedCount || 0,
        syncedAt: existing?.syncedAt || null,
        errorMessage: error.message || "User sync failed.",
        expandProfile: existing?.expandProfile || null,
      });
      throw error;
    }
  })();

  syncPromises.set(key, promise);

  try {
    return await promise;
  } finally {
    syncPromises.delete(key);
  }
};

const readCachedSessionUsers = async (db, { sessionId, orgId }) => {
  const sync = await getUserSyncState(db, { sessionId, orgId });
  if (sync?.status !== "ready") {
    return { sync, users: null };
  }

  const users = await getCachedUsers(db, { sessionId, orgId });
  return { sync, users };
};

export { readCachedSessionUsers, syncSessionUsers, USERS_CACHE_EXPAND };
