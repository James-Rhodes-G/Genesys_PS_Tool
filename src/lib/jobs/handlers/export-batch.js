import { runCatalogExportItem } from "./catalog-export-shared.js";

const buildItems = (payload = {}) => {
  const exportIds = Array.isArray(payload.exportIds)
    ? payload.exportIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  if (!exportIds.length) {
    throw new Error("exportIds is required.");
  }
  return exportIds.map((exportId) => ({ itemId: exportId, payload: { exportId } }));
};

const processItem = async (item, ctx) => runCatalogExportItem(item.payload.exportId, ctx);

const buildResults = (poolResults) =>
  poolResults.map((row) => ({
    ...(row.result || {}),
    itemId: row.itemId,
    poolStatus: row.status,
    error: row.error || row.result?.error || "",
  }));

export { buildItems, buildResults, processItem };
