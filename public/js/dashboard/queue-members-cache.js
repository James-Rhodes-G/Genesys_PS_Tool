import { getInventoryData } from "./inventory-store.js";

let queueMembersById = null;
let loadingPromise = null;

const peekQueueMembersById = () => queueMembersById;

const clearQueueMembersCache = () => {
  queueMembersById = null;
  loadingPromise = null;
};

const loadAllQueueMembers = async (deps, credentials) => {
  if (queueMembersById) {
    return queueMembersById;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  const queues = getInventoryData("queues");
  if (!Array.isArray(queues)) {
    throw new Error("Queue inventory is not loaded");
  }

  loadingPromise = (async () => {
    const membersById = {};

    for (const queue of queues) {
      try {
        membersById[queue.id] = await deps.getQueueMembers({ ...credentials, queueId: queue.id });
      } catch {
        membersById[queue.id] = [];
      }
    }

    queueMembersById = membersById;
    return membersById;
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
};

export { clearQueueMembersCache, loadAllQueueMembers, peekQueueMembersById };
