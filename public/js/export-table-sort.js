const compareExportRowValues = (left, right, columnKey) => {
  const leftValue = String(left?.[columnKey] ?? "");
  const rightValue = String(right?.[columnKey] ?? "");

  if (!leftValue && !rightValue) {
    return 0;
  }
  if (!leftValue) {
    return 1;
  }
  if (!rightValue) {
    return -1;
  }

  return leftValue.localeCompare(rightValue, undefined, { sensitivity: "base", numeric: true });
};

const getExportDisplayRows = (exportMeta, rows = exportMeta?.rows) => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  if (!exportMeta?.sortableColumns || !exportMeta.tableSort?.columnKey) {
    return sourceRows;
  }

  const { columnKey, direction } = exportMeta.tableSort;
  const sorted = [...sourceRows].sort((left, right) => compareExportRowValues(left, right, columnKey));
  return direction === "desc" ? sorted.reverse() : sorted;
};

const handleExportTableSortClick = (event, { getExportMeta, rerenderExportSection }) => {
  if (event.target.closest(".column-resize-handle")) {
    return false;
  }

  const button = event.target.closest(".export-table-sort");
  if (!button) {
    return false;
  }

  const exportId = button.getAttribute("data-export-id");
  const columnKey = button.getAttribute("data-column-key");
  if (!exportId || !columnKey) {
    return false;
  }

  const exportMeta = typeof getExportMeta === "function" ? getExportMeta(exportId) : null;
  if (!exportMeta?.sortableColumns) {
    return false;
  }

  const current = exportMeta.tableSort || { columnKey: null, direction: "asc" };
  if (current.columnKey === columnKey) {
    exportMeta.tableSort = {
      columnKey,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  } else {
    exportMeta.tableSort = { columnKey, direction: "asc" };
  }

  rerenderExportSection(exportId);
  return true;
};

export { getExportDisplayRows, handleExportTableSortClick };
