import { runCatalogExportItem } from "./catalog-export-shared.js";

const buildItems = (payload = {}) => {
  const exportId = String(payload.exportId || "").trim();
  if (!exportId) {
    throw new Error("exportId is required.");
  }
  return [{ itemId: exportId, payload: { exportId } }];
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
