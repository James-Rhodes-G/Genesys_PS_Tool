import { getExportById } from "../../exports/export-registry.js";
import {
  entitiesToRows,
  fetchCatalogEntitiesWithApiClient,
} from "../../exports/catalog-export-service.js";

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
    const rows = entitiesToRows(entities, def);
    return {
      exportId,
      label: def.label,
      rows,
      rowCount: rows.length,
      preferredColumns: def.preferredColumns,
      status: "success",
      error: "",
    };
  } catch (error) {
    return {
      exportId,
      label: def.label,
      rows: [],
      rowCount: 0,
      preferredColumns: def.preferredColumns,
      status: "failed",
      error: error.message || "Catalog export failed.",
    };
  }
};

export { runCatalogExportItem };
