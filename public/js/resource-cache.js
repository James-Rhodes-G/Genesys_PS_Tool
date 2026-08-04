const resourceCaches = {
  phones: null,
  sites: null,
  divisions: null,
  dataTables: null,
};

const clearResourceCaches = () => {
  resourceCaches.phones = null;
  resourceCaches.sites = null;
  resourceCaches.divisions = null;
  resourceCaches.dataTables = null;
};

const loadCachedResource = async (key, credentials, loader) => {
  if (resourceCaches[key]) {
    return resourceCaches[key];
  }

  const data = await loader(credentials);
  resourceCaches[key] = data;
  return data;
};

const getCachedPhones = (credentials, getPhones) => loadCachedResource("phones", credentials, getPhones);

const getCachedSites = (credentials, getSites) => loadCachedResource("sites", credentials, getSites);

const getCachedDivisions = (credentials, getDivisions) => loadCachedResource("divisions", credentials, getDivisions);

const getCachedDataTables = (credentials, getDataTables) => loadCachedResource("dataTables", credentials, getDataTables);

export {
  clearResourceCaches,
  getCachedDataTables,
  getCachedDivisions,
  getCachedPhones,
  getCachedSites,
  loadCachedResource,
};
