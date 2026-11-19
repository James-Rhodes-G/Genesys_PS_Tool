import { renderGuxFieldCheckbox } from "./gux-ui.js";
import { triggerBlobDownload } from "./prompts-export.js";
import { runExportJobViaJob } from "./export-job.js";

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

const buildDocExportProgressMessage = (job, exportIdLabels) => {
  const total = Math.max(0, Number(job?.total) || 0);
  const done = Math.max(0, Number(job?.completed) || 0) + Math.max(0, Number(job?.failed) || 0);
  const processing = Math.max(0, Number(job?.processing) || 0);
  const current = Math.min(total || done + processing, done + processing);

  let moduleHint = "";
  if (processing > 0 && Array.isArray(job?.results)) {
    const active = job.results.find((row) => row.poolStatus === "processing" || row.status === "processing");
    const exportId = active?.exportId || active?.itemId || active?.result?.exportId;
    if (exportId && exportIdLabels?.[exportId]) {
      moduleHint = ` — ${exportIdLabels[exportId]}`;
    } else if (exportId) {
      moduleHint = ` — ${exportId}`;
    }
  }

  const statusLabel =
    job?.status === "queued"
      ? "Queued"
      : job?.status === "running"
        ? `Exporting catalogs${moduleHint}`
        : "Finishing";

  const detail =
    total > 0
      ? `${Math.min(done + processing, total)} of ${total} module(s) (${done} succeeded${Number(job?.failed) ? `, ${job.failed} failed` : ""})`
      : "Preparing catalog exports...";

  return { statusLabel, detail, current: total > 0 ? current : undefined, total: total > 0 ? total : undefined };
};

const createExportAllFeature = ({
  fetchExportRegistry,
  downloadExportBatchPackage,
  downloadExportBatchPackageFromJob,
  submitJob,
  getJob,
  getJobResults,
  docExportProgressModal,
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

    if (docExportProgressModal?.isOpen) {
      return;
    }

    const exportIdLabels = Object.fromEntries(
      (exportMeta.registry?.exports || [])
        .filter((entry) => exportIds.includes(entry.id))
        .map((entry) => [entry.id, entry.label || entry.id])
    );

    const totalModules = exportIds.length;
    docExportProgressModal?.open({
      primaryMessage: "Starting documentation export...",
      additionalGuidance: `0 of ${totalModules} catalog module(s)`,
      current: 0,
      total: totalModules,
    });

    exportMeta.status = "Building documentation ZIP...";
    state.rerenderExportResult?.(resultId);

    const updateModalFromJob = (job) => {
      const { statusLabel, detail, current, total } = buildDocExportProgressMessage(job, exportIdLabels);
      docExportProgressModal?.update({
        primaryMessage: statusLabel,
        additionalGuidance: detail,
        current,
        total,
      });
    };

    try {
      if (!submitJob || !getJob || !getJobResults || !downloadExportBatchPackageFromJob) {
        throw new Error("Documentation export job API is not available.");
      }

      const { job } = await runExportJobViaJob({
        ...credentials,
        type: "export-batch",
        payload: { exportIds },
        onProgress: updateModalFromJob,
        submitJob,
        getJob,
        getJobResults,
      });

      if (job.status === "failed" || job.status === "cancelled") {
        throw new Error(job.error || "Documentation export job failed.");
      }

      if (job.status === "completed_with_errors" && Number(job.completed) === 0) {
        throw new Error("No catalog modules exported successfully.");
      }

      docExportProgressModal?.update({
        primaryMessage: "Building ZIP package...",
        additionalGuidance: "Compressing CSV files for download.",
        current: undefined,
        total: undefined,
      });

      const jobId = job.jobId || job.id;
      const { blob, filename } = await downloadExportBatchPackageFromJob({
        ...credentials,
        jobId,
      });

      triggerBlobDownload(blob, filename);
      docExportProgressModal?.close();
      exportMeta.status = `Downloaded ${filename} (${exportIds.length} module(s)).`;
      state.rerenderExportResult?.(resultId);
    } catch (error) {
      docExportProgressModal?.showError(error.message || "Documentation export failed.");
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
