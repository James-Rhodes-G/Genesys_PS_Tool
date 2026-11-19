import { getExportById } from "../../exports/export-registry.js";
import {
  entitiesToRows,
  fetchCatalogEntitiesWithApiClient,
} from "../../exports/catalog-export-service.js";
import { collectColumnKeys } from "../../exports/rows-to-csv.js";

const runCatalogExportItem = async (exportId, ctx) => {
  const def = getExportById(exportId);
  if (!def) {
    throw new Error(`Unknown export: ${exportId}`);
  }

  try {
    const entities = await fetchCatalogEntitiesWithApiClient(exportId, ctx.apiClient, {
      jobId: ctx.jobId,
      itemId: exportId,
      workerId: ctx.workerId,
    });
    const rows = entitiesToRows(entities);
    const preferredColumns = collectColumnKeys(rows, []);
    return {
      exportId,
      label: def.label,
      rows,
      rowCount: rows.length,
      preferredColumns,
      status: "success",
      error: "",
    };
  } catch (error) {
    return {
      exportId,
      label: def.label,
      rows: [],
      rowCount: 0,
      preferredColumns: [],
      status: "failed",
      error: error.message || "Catalog export failed.",
    };
  }
};

export { runCatalogExportItem };
