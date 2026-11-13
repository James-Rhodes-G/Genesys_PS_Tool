import JSZip from "jszip";
import {
  buildDataTableCsv,
  buildDataTableExportFilename,
} from "./datatables-export-csv.js";

const buildDataTablesExportZip = async ({ exports, orgName }) => {
  const zip = new JSZip();
  const fileResults = [];

  for (const entry of exports || []) {
    const tableName = entry.tableName || entry.tableId || "data_table";
    if (entry.status !== "success" || !Array.isArray(entry.rows) || entry.rows.length === 0) {
      fileResults.push({
        tableId: entry.tableId,
        tableName,
        status: entry.status || "failed",
        rowCount: entry.rowCount ?? 0,
        csvFile: "",
        error: entry.error || "No rows returned for this table.",
        includedInZip: false,
      });
      continue;
    }

    const filename = buildDataTableExportFilename(orgName, tableName);
    zip.file(filename, buildDataTableCsv(entry.rows));
    fileResults.push({
      tableId: entry.tableId,
      tableName,
      status: "success",
      rowCount: entry.rows.length,
      csvFile: filename,
      error: "",
      includedInZip: true,
    });
  }

  const includedCount = fileResults.filter((entry) => entry.includedInZip).length;
  if (includedCount === 0) {
    const error = new Error("No data table rows were available to include in the export package.");
    error.code = "DATATABLE_ZIP_EMPTY";
    throw error;
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return { zipBuffer, fileResults, includedCount };
};

export { buildDataTablesExportZip };
