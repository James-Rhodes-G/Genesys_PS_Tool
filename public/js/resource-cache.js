const resourceCaches = {
  phones: null,
  sites: null,
  divisions: null,
  dataTables: null,
  roles: null,
  queues: null,
  skills: null,
  groups: null,
};

const wrapCacheEntry = (data) => ({
  data,
  cachedAt: Date.now(),
});

const unwrapCacheEntry = (entry) => entry?.data ?? null;

const clearResourceCaches = () => {
  resourceCaches.phones = null;
  resourceCaches.sites = null;
  resourceCaches.divisions = null;
  resourceCaches.dataTables = null;
  resourceCaches.roles = null;
  resourceCaches.queues = null;
  resourceCaches.skills = null;
  resourceCaches.groups = null;
};

const clearCachedPhones = () => {
  resourceCaches.phones = null;
};

const getResourceCacheMeta = (key) => {
  const entry = resourceCaches[key];
  if (!entry) {
    return { loaded: false, cachedAt: null, count: 0 };
  }

  const data = unwrapCacheEntry(entry);
  return {
    loaded: true,
    cachedAt: entry.cachedAt,
    count: Array.isArray(data) ? data.length : 0,
  };
};

const getAllResourceCacheMeta = () => ({
  phones: getResourceCacheMeta("phones"),
  sites: getResourceCacheMeta("sites"),
  divisions: getResourceCacheMeta("divisions"),
  dataTables: getResourceCacheMeta("dataTables"),
  roles: getResourceCacheMeta("roles"),
  queues: getResourceCacheMeta("queues"),
  skills: getResourceCacheMeta("skills"),
  groups: getResourceCacheMeta("groups"),
});

const loadCachedResource = async (key, credentials, loader, { force = false } = {}) => {
  if (!force && resourceCaches[key]) {
    return unwrapCacheEntry(resourceCaches[key]);
  }

  const data = await loader(credentials);
  resourceCaches[key] = wrapCacheEntry(data);
  return data;
};

const getCachedPhones = (credentials, getPhones, options) =>
  loadCachedResource("phones", credentials, getPhones, options);

const getCachedSites = (credentials, getSites, options) =>
  loadCachedResource("sites", credentials, getSites, options);

const getCachedDivisions = (credentials, getDivisions, options) =>
  loadCachedResource("divisions", credentials, getDivisions, options);

const getCachedDataTables = (credentials, getDataTables, options) =>
  loadCachedResource("dataTables", credentials, getDataTables, options);

const getCachedRoles = (credentials, getRoles, options) =>
  loadCachedResource("roles", credentials, getRoles, options);

const getCachedQueues = (credentials, getQueues, options) =>
  loadCachedResource("queues", credentials, getQueues, options);

const getCachedSkills = (credentials, getSkills, options) =>
  loadCachedResource("skills", credentials, getSkills, options);

const getCachedGroups = (credentials, getGroups, options) =>
  loadCachedResource("groups", credentials, getGroups, options);

const peekCachedPhones = () => unwrapCacheEntry(resourceCaches.phones);
const peekCachedSites = () => unwrapCacheEntry(resourceCaches.sites);
const peekCachedDivisions = () => unwrapCacheEntry(resourceCaches.divisions);
const peekCachedDataTables = () => unwrapCacheEntry(resourceCaches.dataTables);
const peekCachedRoles = () => unwrapCacheEntry(resourceCaches.roles);
const peekCachedQueues = () => unwrapCacheEntry(resourceCaches.queues);
const peekCachedSkills = () => unwrapCacheEntry(resourceCaches.skills);
const peekCachedGroups = () => unwrapCacheEntry(resourceCaches.groups);

export {
  clearCachedPhones,
  clearResourceCaches,
  getAllResourceCacheMeta,
  getCachedDataTables,
  getCachedDivisions,
  getCachedGroups,
  getCachedPhones,
  getCachedQueues,
  getCachedRoles,
  getCachedSites,
  getCachedSkills,
  getResourceCacheMeta,
  loadCachedResource,
  peekCachedDataTables,
  peekCachedDivisions,
  peekCachedGroups,
  peekCachedPhones,
  peekCachedQueues,
  peekCachedRoles,
  peekCachedSites,
  peekCachedSkills,
  unwrapCacheEntry,
};
