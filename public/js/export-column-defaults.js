import { fetchExportColumnDefaultsMap } from "./genesys-client.js";

let defaultsByExportType = null;

const loadExportColumnDefaults = async ({ region, token } = {}) => {
  if (!region || !token) {
    defaultsByExportType = {};
    return defaultsByExportType;
  }
  try {
    const payload = await fetchExportColumnDefaultsMap({ region, token });
    defaultsByExportType =
      payload?.defaults && typeof payload.defaults === "object" ? payload.defaults : {};
  } catch {
    defaultsByExportType = {};
  }
  return defaultsByExportType;
};

const getExportColumnDefaults = () => defaultsByExportType || {};

const applyExportColumnDefaults = (exportMeta) => {
  if (!exportMeta?.exportType) {
    return exportMeta;
  }
  const map = getExportColumnDefaults();
  const preferred = map[exportMeta.exportType];
  if (!Array.isArray(preferred) || !preferred.length) {
    return exportMeta;
  }
  const available = new Set((exportMeta.availableColumns || []).map((column) => column.key));
  const selected = preferred.filter((key) => available.has(key));
  if (!selected.length) {
    return exportMeta;
  }
  exportMeta.selectedColumnKeys = selected;
  return exportMeta;
};

const clearExportColumnDefaultsCache = () => {
  defaultsByExportType = null;
};

export {
  loadExportColumnDefaults,
  getExportColumnDefaults,
  applyExportColumnDefaults,
  clearExportColumnDefaultsCache,
};