import {
  getCampaigns,
  getDivisions,
  getGroups,
  getLocations,
  getPhones,
  getQueues,
  getRoles,
  getSites,
  getSkills,
  getTeams,
  getWrapupCodes,
} from "../genesys.js";
import { flattenEntities } from "./flatten-row.js";
import { getExportById } from "./export-registry.js";
import { paginateAllWithApiClient } from "./paginate-all.js";

const CREDENTIAL_FETCHERS = {
  divisions: (credentials) => getDivisions(credentials),
  "wrapup-codes": (credentials) => getWrapupCodes(credentials),
  sites: (credentials) => getSites(credentials),
  locations: (credentials) => getLocations(credentials),
  teams: (credentials) => getTeams(credentials),
  campaigns: (credentials) => getCampaigns(credentials),
  roles: (credentials) => getRoles(credentials),
  queues: (credentials) => getQueues(credentials),
  skills: (credentials) => getSkills(credentials),
  groups: (credentials) => getGroups(credentials),
  phones: (credentials) => getPhones(credentials),
};

const fetchCatalogEntitiesWithCredentials = async (exportId, credentials) => {
  const fetcher = CREDENTIAL_FETCHERS[exportId];
  if (!fetcher) {
    throw new Error(`No credential fetcher registered for export: ${exportId}`);
  }
  return fetcher(credentials);
};

const fetchCatalogEntitiesWithApiClient = async (exportId, apiClient, itemContext = {}) => {
  const def = getExportById(exportId);
  if (!def?.listPath) {
    throw new Error(`Unknown export or missing listPath: ${exportId}`);
  }
  return paginateAllWithApiClient(apiClient, def.listPath, { itemContext });
};

const entitiesToRows = (entities, exportDef) =>
  flattenEntities(entities, { preferredColumns: exportDef?.preferredColumns || [] });

const fetchCatalogRows = async (exportId, credentials) => {
  const def = getExportById(exportId);
  if (!def) {
    throw new Error(`Unknown export: ${exportId}`);
  }
  const entities = await fetchCatalogEntitiesWithCredentials(exportId, credentials);
  const rows = entitiesToRows(entities, def);
  return { exportId, label: def.label, rows, rowCount: rows.length, preferredColumns: def.preferredColumns };
};

export {
  fetchCatalogEntitiesWithCredentials,
  fetchCatalogEntitiesWithApiClient,
  entitiesToRows,
  fetchCatalogRows,
  CREDENTIAL_FETCHERS,
};
