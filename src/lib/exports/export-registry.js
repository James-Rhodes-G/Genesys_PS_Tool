/** `preferredColumns` are documentation hints for the registry API only; batch/ZIP exports use wide flatten. */

const EXPORT_CATEGORIES = {
  directory: "Org and directory",
  people: "People and routing",
  telephony: "Telephony",
  architect: "Architect",
  outbound: "Outbound",
};

/** @typedef {import('./catalog-export-service.js').CatalogExportDef} CatalogExportDef */

/** @type {CatalogExportDef[]} */
const CATALOG_EXPORTS = [
  {
    id: "divisions",
    label: "Divisions",
    gchModules: ["Divisions"],
    category: "directory",
    listPath: "/api/v2/authorization/divisions?pageSize=100&sortBy=name&sortOrder=ASC",
    preferredColumns: ["name", "id", "home", "description"],
    batchDefault: true,
  },
  {
    id: "wrapup-codes",
    label: "Wrap-Up Codes",
    gchModules: ["Wrap-Up Details"],
    category: "people",
    listPath: "/api/v2/routing/wrapupcodes",
    preferredColumns: ["name", "id", "division.name", "description", "dateCreated"],
    batchDefault: true,
  },
  {
    id: "sites",
    label: "Sites",
    gchModules: ["Phone Details"],
    category: "telephony",
    listPath: "/api/v2/telephony/providers/edges/sites",
    preferredColumns: ["name", "id", "location.name", "managed"],
    batchDefault: true,
  },
  {
    id: "locations",
    label: "Locations",
    gchModules: ["Locations"],
    category: "directory",
    listPath: "/api/v2/locations",
    preferredColumns: ["name", "id", "state"],
    batchDefault: true,
  },
  {
    id: "teams",
    label: "Teams",
    gchModules: ["Teams"],
    category: "people",
    listPath: "/api/v2/teams",
    preferredColumns: ["name", "id", "memberCount", "description"],
    batchDefault: true,
  },
  {
    id: "campaigns",
    label: "Campaigns",
    gchModules: ["Campaigns"],
    category: "outbound",
    listPath: "/api/v2/outbound/campaigns",
    preferredColumns: ["name", "id", "division.name", "campaignStatus", "dialingMode"],
    batchDefault: true,
  },
  {
    id: "roles",
    label: "Roles",
    gchModules: ["Agent Roles", "System Roles"],
    category: "directory",
    listPath: "/api/v2/authorization/roles",
    preferredColumns: ["name", "id", "description", "permissionPolicies"],
    batchDefault: true,
    uiNavId: "genesys-roles",
  },
  {
    id: "queues",
    label: "Queues",
    gchModules: ["Queues"],
    category: "people",
    listPath: "/api/v2/routing/queues",
    preferredColumns: [
      "name",
      "id",
      "division.name",
      "description",
      "memberCount",
      "acwSettings.wrapupCode",
    ],
    batchDefault: true,
    uiNavId: "genesys-queues",
  },
  {
    id: "skills",
    label: "Skills",
    gchModules: ["Skills and Languages"],
    category: "people",
    listPath: "/api/v2/routing/skills?sortBy=name&sortOrder=asc",
    preferredColumns: ["name", "id", "state"],
    batchDefault: true,
    uiNavId: "genesys-skills",
  },
  {
    id: "groups",
    label: "Groups",
    gchModules: ["Directory Groups"],
    category: "directory",
    listPath: "/api/v2/groups?sortOrder=ascending",
    preferredColumns: ["name", "id", "memberCount", "type", "visibility"],
    batchDefault: true,
    uiNavId: "genesys-groups",
  },
  {
    id: "phones",
    label: "Phones",
    gchModules: ["Phone Details"],
    category: "telephony",
    listPath: "/api/v2/telephony/providers/edges/phones",
    preferredColumns: ["name", "id", "site.name", "phoneBaseSettings.name", "division.name"],
    batchDefault: false,
    uiNavId: "genesys-phones",
  },
];

const exportById = new Map(CATALOG_EXPORTS.map((entry) => [entry.id, entry]));

const getExportById = (id) => exportById.get(String(id || "").trim()) || null;

const listCatalogExports = () => CATALOG_EXPORTS.map((entry) => ({ ...entry }));

const listExportsForRegistryApi = () =>
  CATALOG_EXPORTS.map(({ id, label, gchModules, category, batchDefault, uiNavId }) => ({
    id,
    label,
    gchModules,
    category,
    categoryLabel: EXPORT_CATEGORIES[category] || category,
    batchDefault: batchDefault !== false,
    uiNavId: uiNavId || null,
  }));

const listDefaultBatchExportIds = () =>
  CATALOG_EXPORTS.filter((entry) => entry.batchDefault !== false).map((entry) => entry.id);

const listUiCatalogExports = () => CATALOG_EXPORTS.filter((entry) => !entry.uiNavId);

export {
  EXPORT_CATEGORIES,
  CATALOG_EXPORTS,
  getExportById,
  listCatalogExports,
  listExportsForRegistryApi,
  listDefaultBatchExportIds,
  listUiCatalogExports,
};
