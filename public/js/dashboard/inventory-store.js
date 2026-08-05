import {
  getResourceCacheMeta,
  peekCachedGroups,
  peekCachedQueues,
  peekCachedRoles,
  peekCachedSkills,
} from "../resource-cache.js";

const inventoryEntries = new Map();

const RESOURCE_CACHE_KEYS = new Set(["roles", "queues", "skills", "groups"]);

const peekCachedInventoryData = (key) => {
  if (key === "roles") {
    return peekCachedRoles();
  }
  if (key === "queues") {
    return peekCachedQueues();
  }
  if (key === "skills") {
    return peekCachedSkills();
  }
  if (key === "groups") {
    return peekCachedGroups();
  }

  return null;
};

const clearInventoryStore = () => {
  inventoryEntries.clear();
};

const setInventoryEntry = (key, data) => {
  inventoryEntries.set(key, {
    data,
    count: Array.isArray(data) ? data.length : Number(data?.count ?? 0),
    cachedAt: Date.now(),
  });
};

const getInventoryMeta = (key) => {
  if (RESOURCE_CACHE_KEYS.has(key)) {
    return getResourceCacheMeta(key);
  }

  const entry = inventoryEntries.get(key);
  if (!entry) {
    return { loaded: false, cachedAt: null, count: 0 };
  }

  return {
    loaded: true,
    cachedAt: entry.cachedAt,
    count: entry.count,
  };
};

const getInventoryData = (key) => {
  if (RESOURCE_CACHE_KEYS.has(key)) {
    return peekCachedInventoryData(key);
  }

  return inventoryEntries.get(key)?.data ?? null;
};

const loadInventoryEntry = async (key, loader) => {
  const data = await loader();
  if (!RESOURCE_CACHE_KEYS.has(key)) {
    setInventoryEntry(key, data);
  }
  return data;
};

const INVENTORY_RESOURCES = [
  { key: "queues", label: "Queues", exportNavId: "genesys-queues" },
  { key: "skills", label: "Skills", exportNavId: "genesys-skills" },
  { key: "roles", label: "Roles", exportNavId: "genesys-roles" },
  { key: "groups", label: "Groups", exportNavId: "genesys-groups" },
  { key: "prompts", label: "Prompts", exportNavId: "genesys-prompts" },
];

export {
  INVENTORY_RESOURCES,
  clearInventoryStore,
  getInventoryData,
  getInventoryMeta,
  loadInventoryEntry,
  setInventoryEntry,
};
