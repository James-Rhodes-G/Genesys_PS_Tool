import { renderGuxFieldCheckbox } from "./gux-ui.js";
import { triggerBlobDownload } from "./prompts-export.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const groupExportsByCategory = (exports) => {
  const groups = new Map();
  for (const entry of exports || []) {
    const key = entry.categoryLabel || entry.category || "Other";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(entry);
  }
  return [...groups.entries()];
};

const createExportAllMeta = (resultId, registry, title, status) => {
  const selected = {};
  for (const entry of registry?.exports || []) {
    if (entry.batchDefault !== false) {
      selected[entry.id] = true;
    }
  }

  return {
    kind: "export-all",
    resultId,
    title,
    status,
    exportType: "export_all",
    registry: registry || { exports: [], defaultBatchExportIds: [] },
    selectedExportIds: selected,
    hideActions: true,
    editable: true,
    rows: registry?.exports || [],
  };
};

const renderExportAllBody = (resultId, exportMeta) => {
  const selected = exportMeta.selectedExportIds || {};
  const grouped = groupExportsByCategory(exportMeta.registry?.exports || []);

  const sections = grouped
    .map(([categoryLabel, items]) => {
      const rows = items
        .map(
          (entry) => `<div class="bulk-user-row">${renderGuxFieldCheckbox({
            escapeHtml,
            className: "export-all-checkbox",
            label: `<span>${escapeHtml(entry.label)}</span> <span class="muted">${escapeHtml(entry.id)}</span>`,
            checked: Boolean(selected[entry.id]),
            attrs: `data-result-id="${escapeHtml(resultId)}" data-export-id="${escapeHtml(entry.id)}"`,
          })}</div>`
        )
        .join("");

      return `<section class="export-all-category">
        <h3 class="export-all-category__title">${escapeHtml(categoryLabel)}</h3>
        ${rows}
      </section>`;
    })
    .join("");

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return `<div class="column-editor export-all-panel">
    <div class="column-editor__header">Documentation export (exportAll)</div>
    <p class="muted">Select catalog exports to include in one ZIP (one CSV per module). Grouping matches the Exports nav sections (org, people, telephony, architect, outbound).</p>
    ${sections || "<p class=\"muted\">No exports in registry.</p>"}
    <div class="export-all-actions">
      <gux-button class="export-all-run" type="button" accent="primary" data-result-id="${escapeHtml(
        resultId
      )}">Download ZIP (${selectedCount} selected)</gux-button>
    </div>
  </div>`;
};

const createExportAllFeature = ({
  fetchExportRegistry,
  downloadExportBatchPackage,
  startExportResult,
  finishExportResult,
  renderLoadingState,
  requireCredentials,
  state,
  rerenderExportSection,
}) => {
  state.rerenderExportResult = rerenderExportSection;
  const openExportAll = async () => {
    if (!state.hasConnection) {
      return;
    }

    const credentials = requireCredentials("Export: Documentation bundle");
    if (!credentials) {
      return;
    }

    const resultId = startExportResult(
      "Export: Documentation bundle",
      "Loading export registry...",
      renderLoadingState("Fetching /api/genesys/exports/registry...")
    );

    try {
      const registry = await fetchExportRegistry();
      const exportMeta = createExportAllMeta(resultId, registry, "Export: Documentation bundle", "Ready");
      exportMeta.renderBody = () => renderExportAllBody(resultId, state.exportData[resultId] || exportMeta);
      finishExportResult(
        resultId,
        "Export: Documentation bundle",
        "Select catalogs and download a ZIP package.",
        "",
        exportMeta
      );
    } catch (error) {
      finishExportResult(
        resultId,
        "Export: Documentation bundle",
        error.message || "Failed to load export registry.",
        ""
      );
    }
  };

  const handleClick = async (event) => {
    const runButton = event.target.closest(".export-all-run");
    if (!runButton) {
      return;
    }

    const resultId = runButton.getAttribute("data-result-id");
    const exportMeta = state.exportData?.[resultId];
    if (!exportMeta || exportMeta.kind !== "export-all") {
      return;
    }

    const credentials = requireCredentials(exportMeta.title);
    if (!credentials) {
      return;
    }

    const exportIds = Object.entries(exportMeta.selectedExportIds || {})
      .filter(([, selected]) => selected)
      .map(([id]) => id);

    if (!exportIds.length) {
      exportMeta.status = "Select at least one catalog export.";
      state.rerenderExportResult?.(resultId);
      return;
    }

    exportMeta.status = "Building documentation ZIP...";
    state.rerenderExportResult?.(resultId);

    try {
      const { blob, filename } = await downloadExportBatchPackage({
        ...credentials,
        exportIds,
      });
      triggerBlobDownload(blob, filename);
      exportMeta.status = `Downloaded ${filename} (${exportIds.length} module(s)).`;
      state.rerenderExportResult?.(resultId);
    } catch (error) {
      exportMeta.status = error.message || "Documentation export failed.";
      state.rerenderExportResult?.(resultId);
    }
  };

  const handleChange = (event) => {
    const checkbox = event.target.closest(".export-all-checkbox");
    if (!checkbox) {
      return;
    }

    const resultId = checkbox.getAttribute("data-result-id");
    const exportId = checkbox.getAttribute("data-export-id");
    const exportMeta = state.exportData?.[resultId];
    if (!exportMeta || exportMeta.kind !== "export-all") {
      return;
    }

    exportMeta.selectedExportIds = exportMeta.selectedExportIds || {};
    exportMeta.selectedExportIds[exportId] = checkbox.checked;
    state.rerenderExportResult?.(resultId);
  };

  const wireExportAll = (button) => {
    if (!button) {
      return;
    }
    button.addEventListener("click", openExportAll);
  };

  const attachExportAllListeners = (root) => {
    if (!root) {
      return;
    }
    root.addEventListener("click", handleClick);
    root.addEventListener("change", handleChange);
  };

  return {
    wireExportAll,
    attachExportAllListeners,
    renderExportAllBody,
    createExportAllMeta,
  };
};

export { createExportAllFeature, renderExportAllBody, createExportAllMeta };
