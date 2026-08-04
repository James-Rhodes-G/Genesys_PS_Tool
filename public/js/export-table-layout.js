const MIN_EXPORT_COLUMN_WIDTH = 72;

const wireExportTableResize = (exportId, { getExportMeta } = {}) => {
  const resultEl = document.getElementById(exportId);
  const table = resultEl?.querySelector("table.export-data-table");
  if (!table) {
    return;
  }

  table.querySelectorAll(".column-resize-handle").forEach((handle) => {
    handle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const th = handle.closest("th");
      if (!th) {
        return;
      }

      const colIndex = th.cellIndex;
      const col = table.querySelectorAll("col")[colIndex];
      const startX = event.clientX;
      const startWidth = th.getBoundingClientRect().width;

      const onMouseMove = (moveEvent) => {
        const nextWidth = Math.max(
          MIN_EXPORT_COLUMN_WIDTH,
          Math.round(startWidth + moveEvent.clientX - startX)
        );

        if (col) {
          col.style.width = `${nextWidth}px`;
        }
        th.style.width = `${nextWidth}px`;
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.classList.remove("export-table-col-resizing");

        const exportMeta = typeof getExportMeta === "function" ? getExportMeta() : null;
        const columnKey = th.getAttribute("data-column-key");
        if (!exportMeta || !columnKey) {
          return;
        }

        exportMeta.columnWidths = exportMeta.columnWidths || {};
        exportMeta.columnWidths[columnKey] = Math.round(th.getBoundingClientRect().width);
      };

      document.body.classList.add("export-table-col-resizing");
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  });
};

export { MIN_EXPORT_COLUMN_WIDTH, wireExportTableResize };
