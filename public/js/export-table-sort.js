import { getRowSortValue } from "./export-column-values.js";

const compareExportRowValues = (left, right, columnKey, exportMeta) => {
  const leftValue = getRowSortValue(left, columnKey, exportMeta);
  const rightValue = getRowSortValue(right, columnKey, exportMeta);

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

const compareDomCellText = (leftText, rightText) => {
  const leftValue = String(leftText ?? "").trim();
  const rightValue = String(rightText ?? "").trim();

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

const ensureExportTableSort = (exportMeta) => {
  if (!exportMeta || exportMeta.sortableColumns === false || !Array.isArray(exportMeta.rows)) {
    return exportMeta;
  }

  exportMeta.sortableColumns = true;
  if (!exportMeta.tableSort) {
    exportMeta.tableSort = { columnKey: null, direction: "asc" };
  }

  return exportMeta;
};

const getExportDisplayRows = (exportMeta, rows = exportMeta?.rows) => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  if (exportMeta?.sortableColumns === false || !exportMeta?.tableSort?.columnKey) {
    return sourceRows;
  }

  const { columnKey, direction } = exportMeta.tableSort;
  const sorted = [...sourceRows].sort((left, right) => compareExportRowValues(left, right, columnKey, exportMeta));
  return direction === "desc" ? sorted.reverse() : sorted;
};

const getSortableTableRenderProps = (exportMeta, exportId = "") => ({
  exportId: exportId || exportMeta?.resultId || "",
  sortableColumns: exportMeta?.sortableColumns !== false,
  sortState: exportMeta?.tableSort || null,
});

const getColumnIndex = (table, columnKey) => {
  const headers = [...table.querySelectorAll("thead th[data-column-key]")];
  return headers.findIndex((header) => header.getAttribute("data-column-key") === columnKey);
};

const updateDomSortIndicators = (table, columnKey, direction) => {
  table.querySelectorAll(".export-table-sort").forEach((button) => {
    const key = button.getAttribute("data-column-key");
    const indicator = button.querySelector(".export-table-sort__indicator");
    if (key === columnKey) {
      button.setAttribute("aria-sort", direction === "desc" ? "descending" : "ascending");
      if (indicator) {
        indicator.textContent = direction === "desc" ? "↓" : "↑";
      }
    } else {
      button.setAttribute("aria-sort", "none");
      if (indicator) {
        indicator.textContent = "";
      }
    }
  });
};

const sortExportTableDom = (table, columnKey, direction) => {
  const columnIndex = getColumnIndex(table, columnKey);
  const tbody = table.querySelector("tbody");
  if (columnIndex < 0 || !tbody) {
    return false;
  }

  const rows = [...tbody.querySelectorAll("tr")];
  const factor = direction === "desc" ? -1 : 1;
  rows.sort((leftRow, rightRow) => {
    const leftText = leftRow.cells[columnIndex]?.textContent ?? "";
    const rightText = rightRow.cells[columnIndex]?.textContent ?? "";
    return compareDomCellText(leftText, rightText) * factor;
  });
  rows.forEach((row) => tbody.appendChild(row));
  table.dataset.sortColumn = columnKey;
  table.dataset.sortDirection = direction;
  updateDomSortIndicators(table, columnKey, direction);
  return true;
};

const sortExportTableDomFromButton = (button, columnKey) => {
  const table = button.closest("table.export-data-table");
  if (!table) {
    return false;
  }

  const previousColumn = table.dataset.sortColumn || "";
  const previousDirection = table.dataset.sortDirection === "desc" ? "desc" : "asc";
  let direction = "asc";
  if (previousColumn === columnKey) {
    direction = previousDirection === "asc" ? "desc" : "asc";
  }

  return sortExportTableDom(table, columnKey, direction);
};

const handleExportTableSortClick = (event, { getExportMeta, rerenderExportSection }) => {
  if (event.target.closest(".column-resize-handle")) {
    return false;
  }

  const button = event.target.closest(".export-table-sort");
  if (!button) {
    return false;
  }

  const columnKey = button.getAttribute("data-column-key");
  if (!columnKey) {
    return false;
  }

  const exportId = button.getAttribute("data-export-id") || "";
  const exportMeta = exportId && typeof getExportMeta === "function" ? getExportMeta(exportId) : null;
  const useMetaSort =
    exportMeta &&
    exportMeta.sortableColumns !== false &&
    Array.isArray(exportMeta.rows) &&
    typeof rerenderExportSection === "function";

  if (useMetaSort) {
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
  }

  return sortExportTableDomFromButton(button, columnKey);
};

const wireExportTableSort = ({ getExportMeta, rerenderExportSection }) => {
  document.addEventListener("click", (event) => {
    handleExportTableSortClick(event, { getExportMeta, rerenderExportSection });
  });
};

export {
  ensureExportTableSort,
  getExportDisplayRows,
  getSortableTableRenderProps,
  handleExportTableSortClick,
  wireExportTableSort,
};
