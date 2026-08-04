import { renderGuxFieldCheckbox, renderGuxFieldText } from "./gux-ui.js";
import { summarizeBulkStatuses } from "./bulk-utils.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const filterDataTables = (tables, filterText) => {
  const query = String(filterText || "").trim().toLowerCase();
  if (!query) {
    return tables;
  }

  return tables.filter((table) => {
    const haystack = [table.name, table.id, table.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
};

const createDataTableExportMeta = (resultId, tables, title, status) => ({
  kind: "datatable-export",
  resultId,
  title,
  status,
  exportType: "datatable_export",
  rows: tables,
  editMode: false,
  editable: true,
  tableFilter: "",
  selectedTablesById: {},
  availableColumns: [
    { key: "name", header: "Name" },
    { key: "id", header: "ID" },
    { key: "description", header: "Description" },
  ],
  selectedColumnKeys: ["name", "id", "description"],
});

const renderDataTableExportBody = (resultId, exportMeta) => {
  const filteredTables = filterDataTables(exportMeta.rows || [], exportMeta.tableFilter);
  const selectedIds = new Set(Object.keys(exportMeta.selectedTablesById || {}));
  const allFilteredSelected =
    filteredTables.length > 0 && filteredTables.every((table) => selectedIds.has(String(table.id)));

  const tableRowsHtml = filteredTables
    .map(
      (table) =>
        `<div class="bulk-user-row">${renderGuxFieldCheckbox({
          escapeHtml,
          className: "datatable-export-checkbox",
          label: `<span>${escapeHtml(table.name || table.id)}</span> <span class="muted">${escapeHtml(
            table.id
          )}${table.description ? ` · ${escapeHtml(table.description)}` : ""}</span>`,
          checked: selectedIds.has(String(table.id)),
          attrs: `data-result-id="${escapeHtml(resultId)}" data-table-id="${escapeHtml(table.id)}"`,
        })}</div>`
    )
    .join("");

  const selectedCount = Object.keys(exportMeta.selectedTablesById || {}).length;

  return `<div class="column-editor">
    <div class="column-editor__header">Data Table Exporter</div>
    <p class="muted">Select Architect data tables to export. Row data is fetched live at export time.</p>
    <div class="bulk-skill-filters">
      ${renderGuxFieldText({
        escapeHtml,
        inputId: `${resultId}-datatable-filter`,
        className: "datatable-export-filter",
        label: "Filter tables",
        value: exportMeta.tableFilter || "",
        placeholder: "Search by name, ID, or description",
        attrs: `data-result-id="${escapeHtml(resultId)}"`,
      })}
    </div>
    <div class="bulk-control-row bulk-control-row--actions">
      ${renderGuxFieldCheckbox({
        escapeHtml,
        inputId: `${resultId}-datatable-select-all`,
        className: "datatable-export-select-all",
        label: `<span class="bulk-select-all-label">Select All Filtered (${filteredTables.length})</span>`,
        checked: allFilteredSelected,
        attrs: `data-result-id="${escapeHtml(resultId)}"`,
      })}
      ${renderGuxFieldCheckbox({
        escapeHtml,
        inputId: `${resultId}-datatable-select-none`,
        className: "datatable-export-select-none",
        label: "Select None",
        checked: false,
        attrs: `data-result-id="${escapeHtml(resultId)}"`,
      })}
    </div>
    <div class="bulk-skill-user-results">${tableRowsHtml || '<p class="muted">No data tables match the current filter.</p>'}</div>
  </div>
  <div class="bulk-skill-actions">
    <gux-button class="datatable-export-run" type="button" accent="primary" data-result-id="${escapeHtml(
      resultId
    )}">Export Selected Tables</gux-button>
    <span class="muted bulk-selection-summary">${selectedCount} table(s) selected</span>
  </div>`;
};

const createDataTableExportResultsMeta = (resultId, rows, title, status) => ({
  resultId,
  title,
  status,
  exportType: "datatable_export_results",
  rows,
  editMode: false,
  availableColumns: [
    { key: "tableName", header: "Table Name" },
    { key: "tableId", header: "Table ID" },
    { key: "status", header: "Status" },
    { key: "rowCount", header: "Row Count" },
    { key: "error", header: "Error" },
  ],
  selectedColumnKeys: ["tableName", "tableId", "status", "rowCount", "error"],
});

const createDataTableExportFeature = ({
  state,
  getCachedDataTables,
  exportDataTables,
  requireCredentials,
  startExportResult,
  finishExportResult,
  rerenderExportSection,
  prependExportResult,
  renderLoadingState,
  renderJsonBlock,
  renderExportProgressState,
}) => {
  const refreshSelectionSummary = (resultId, exportMeta) => {
    const summaryEl = document.getElementById(resultId)?.querySelector(".bulk-selection-summary");
    if (summaryEl) {
      summaryEl.textContent = `${Object.keys(exportMeta.selectedTablesById || {}).length} table(s) selected`;
    }
  };

  const wireButton = (button, { hasConnection }) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!hasConnection()) {
        return;
      }

      const credentials = requireCredentials("Data Table Export");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Data Table Export",
        "Loading data tables...",
        renderLoadingState("Fetching Architect data tables...")
      );

      try {
        const tables = await getCachedDataTables(credentials);
        const sortedTables = tables
          .slice()
          .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
        const status = `Loaded ${sortedTables.length} data table(s)`;
        const exportMeta = createDataTableExportMeta(loadingResultId, sortedTables, "Data Table Export", status);
        exportMeta.renderBody = () => renderDataTableExportBody(loadingResultId, state.exportData[loadingResultId]);
        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Data Table Export",
          error.message || "Data table load failed",
          renderJsonBlock(error.payload || { error: error.message || "Data table load failed" })
        );
      }
    });
  };

  const executeExport = async (resultId, exportMeta, selectedTables) => {
    const resultEl = document.getElementById(resultId);
    const credentials = requireCredentials("Data Table Export");
    if (!resultEl || !exportMeta || !credentials) {
      return;
    }

    const tableIds = selectedTables.map((table) => table.id);
    const updateProgress = (current, total, message) => {
      const body = resultEl.querySelector(".export-results__body");
      if (body) {
        body.innerHTML = renderExportProgressState({
          message,
          current,
          total,
          resultId,
        });
      }
    };

    updateProgress(0, tableIds.length, `Exporting ${tableIds.length} data table(s)...`);

    try {
      const exports = await exportDataTables({ ...credentials, tableIds });

      const combinedRows = [];
      exports.forEach((entry) => {
        if (Array.isArray(entry.rows)) {
          combinedRows.push(...entry.rows);
        }
      });

      const summaryRows = exports.map((entry) => ({
        tableName: entry.tableName || entry.tableId,
        tableId: entry.tableId,
        status: entry.status || "unknown",
        rowCount: entry.rowCount ?? (entry.rows?.length || 0),
        error: entry.error || "",
      }));
      const status = summarizeBulkStatuses(summaryRows);

      if (combinedRows.length > 0) {
        const exportResultsMeta = {
          resultId,
          title: "Data Table Export",
          status,
          exportType: "datatable_export_rows",
          rows: combinedRows,
          editMode: false,
          availableColumns: Object.keys(combinedRows[0] || {}).map((key) => ({
            key,
            header: key,
          })),
          selectedColumnKeys: Object.keys(combinedRows[0] || {}),
        };
        finishExportResult(resultId, "Data Table Export", status, "", exportResultsMeta);
        return;
      }

      finishExportResult(
        resultId,
        "Data Table Export",
        status,
        "",
        createDataTableExportResultsMeta(resultId, summaryRows, "Data Table Export", status)
      );
    } catch (error) {
      finishExportResult(
        resultId,
        "Data Table Export",
        error.message || "Data table export failed",
        renderJsonBlock(error.payload || { error: error.message || "Data table export failed" })
      );
    }
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const exportButton = target.closest(".datatable-export-run");
    if (!exportButton) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const resultId = exportButton.getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    if (!resultId || !exportMeta) {
      return true;
    }

    const selectedTables = Object.values(exportMeta.selectedTablesById || {});
    if (selectedTables.length === 0) {
      prependExportResult(
        "Data Table Export",
        "No tables selected",
        '<p class="muted">Select at least one data table before exporting.</p>'
      );
      return true;
    }

    await executeExport(resultId, exportMeta, selectedTables);
    return true;
  };

  const handleChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return false;
    }

    const resultId = target.getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    if (!resultId || !exportMeta) {
      return false;
    }

    if (target.classList.contains("datatable-export-filter")) {
      exportMeta.tableFilter = target.value;
      rerenderExportSection(resultId);
      return true;
    }

    if (target.classList.contains("datatable-export-checkbox")) {
      const tableId = target.getAttribute("data-table-id");
      if (!tableId) {
        return false;
      }

      const nextSelected = { ...(exportMeta.selectedTablesById || {}) };
      if (target.checked) {
        const table = (exportMeta.rows || []).find((entry) => String(entry.id) === String(tableId));
        if (table) {
          nextSelected[tableId] = table;
        }
      } else {
        delete nextSelected[tableId];
      }

      exportMeta.selectedTablesById = nextSelected;
      refreshSelectionSummary(resultId, exportMeta);
      rerenderExportSection(resultId);
      return true;
    }

    if (target.classList.contains("datatable-export-select-all")) {
      const filteredTables = filterDataTables(exportMeta.rows || [], exportMeta.tableFilter);
      const nextSelected = { ...(exportMeta.selectedTablesById || {}) };
      filteredTables.forEach((table) => {
        nextSelected[table.id] = table;
      });
      exportMeta.selectedTablesById = nextSelected;
      rerenderExportSection(resultId);
      return true;
    }

    if (target.classList.contains("datatable-export-select-none")) {
      exportMeta.selectedTablesById = {};
      rerenderExportSection(resultId);
      return true;
    }

    return false;
  };

  return { wireButton, handleClick, handleChange };
};

export { createDataTableExportFeature, createDataTableExportMeta };
