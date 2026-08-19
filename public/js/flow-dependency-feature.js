import {
  discoverFlowDependencies,
  listArchitectFlowsByType,
  republishFlow,
} from "./flow-dependency-client.js";
import { renderGuxFieldSelect, resolveDropdownChange } from "./gux-ui.js";

const FLOW_TYPE_OPTIONS = [
  { key: "bot", label: "Bot Flows" },
  { key: "commonmodule", label: "Common Module Flows" },
  { key: "inbound", label: "Inbound Flows" },
  { key: "inqueue", label: "In-Queue Flows" },
];

const ELIGIBILITY = {
  ELIGIBLE: "ELIGIBLE",
  NEWER_VERSION_EXISTS: "NEWER_VERSION_EXISTS",
  HISTORICAL_DEPENDENCY_ONLY: "HISTORICAL_DEPENDENCY_ONLY",
};

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderStatusMark = (value) => (value ? "✓" : "✕");

const getSourceModuleFromFeatureState = (featureState) => {
  const stored = featureState.sourceModule || featureState.summary?.sourceModule;
  if (stored?.id) {
    return {
      id: String(stored.id).trim(),
      name: String(stored.name || stored.id).trim(),
      version: String(stored.version || "published").trim() || "published",
    };
  }

  const id =
    featureState.selectedFlow?.id ||
    featureState.summary?.selectedFlowId ||
    featureState.selectedFlowId ||
    "";
  const matchedFlow = (featureState.flowOptions || []).find((option) => option.id === id);

  return {
    id: String(id).trim(),
    name:
      featureState.selectedFlow?.name ||
      featureState.summary?.selectedFlowName ||
      matchedFlow?.name ||
      String(id).trim(),
    version: "published",
  };
};

const defaultFeatureState = () => ({
  phase: "setup",
  sourceFlowTypeKey: "",
  selectedFlowId: "",
  flowOptions: [],
  loadingFlows: false,
  searching: false,
  republishing: false,
  expandedFlowIds: {},
  republishProgressByFlowId: {},
  summary: null,
  warning: "",
  partialResults: false,
  activeResults: [],
  inactiveResults: [],
  selectedFlow: null,
  sourceModule: null,
});

const createFlowDependencyBulkResultsMeta = (resultId, rows, title, status) => ({
  resultId,
  title,
  status,
  exportType: "flow_dependency_republish",
  rows,
  editMode: false,
  availableColumns: [
    { key: "flowName", header: "Flow Name" },
    { key: "flowId", header: "Flow ID" },
    { key: "status", header: "Status" },
    { key: "publishedVersionId", header: "Published Version" },
    { key: "error", header: "Error" },
  ],
  selectedColumnKeys: ["flowName", "flowId", "status", "publishedVersionId", "error"],
});

const renderRepublishProgress = (progress) => {
  if (!progress) {
    return "";
  }

  const stages = ["checkout", "validate", "publish", "complete"];
  return `<div class="flow-dep-progress">
    ${stages
      .map((stage) => {
        const entry = progress[stage] || { status: "pending" };
        const label = stage.charAt(0).toUpperCase() + stage.slice(1);
        return `<div class="flow-dep-progress__step flow-dep-progress__step--${escapeHtml(entry.status)}">
          <span>${escapeHtml(label)}</span>
          ${entry.error ? `<span class="flow-dep-progress__error">${escapeHtml(entry.error)}</span>` : ""}
        </div>`;
      })
      .join('<span class="flow-dep-progress__arrow">↓</span>')}
  </div>`;
};

const renderVersionTable = (versionDetails) => {
  if (!versionDetails?.length) {
    return "";
  }

  return `<table class="flow-dep-version-table">
    <thead><tr><th>Version</th><th>State</th><th>Dependency</th></tr></thead>
    <tbody>
      ${versionDetails
        .map(
          (entry) => `<tr>
            <td>v${escapeHtml(entry.versionId)}</td>
            <td>${escapeHtml(entry.state)}</td>
            <td>${renderStatusMark(entry.hasDependency)}</td>
          </tr>`
        )
        .join("")}
    </tbody>
  </table>`;
};

const renderFlowCard = (resultId, entry, featureState) => {
  const expanded = Boolean(featureState.expandedFlowIds[entry.flowId]);
  const inactive = !entry.activeDependency;
  const eligible = entry.eligibility === ELIGIBILITY.ELIGIBLE;
  const progress = featureState.republishProgressByFlowId[entry.flowId];
  const flowLink = entry.architectUrl
    ? `<a href="${escapeHtml(entry.architectUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(entry.flowName)} ↗</a>`
    : escapeHtml(entry.flowName);

  return `<article class="flow-dep-card${inactive ? " flow-dep-card--inactive" : ""}${expanded ? " is-expanded" : ""}" data-flow-id="${escapeHtml(entry.flowId)}">
    <div class="flow-dep-card__header">
      <button type="button" class="flow-dep-card__toggle" data-flow-dep-action="toggle-card" data-result-id="${escapeHtml(resultId)}" data-flow-id="${escapeHtml(entry.flowId)}" aria-expanded="${expanded ? "true" : "false"}">${expanded ? "▼" : "▶"}</button>
      <div class="flow-dep-card__title">${flowLink}</div>
      <div class="flow-dep-card__meta">Published v${escapeHtml(entry.publishedVersionId || "—")}</div>
      <div class="flow-dep-card__status">${renderStatusMark(entry.activeDependency)}</div>
      <div class="flow-dep-card__status">${renderStatusMark(eligible)}</div>
      ${
        eligible
          ? `<gux-button class="flow-dep-card__republish" type="button" accent="primary" data-flow-dep-action="republish-one" data-result-id="${escapeHtml(resultId)}" data-flow-id="${escapeHtml(entry.flowId)}"${featureState.republishing ? " disabled" : ""}>Republish</gux-button>`
          : ""
      }
    </div>
    ${
      expanded
        ? `<div class="flow-dep-card__body">
            <p class="flow-dep-card__reason">${escapeHtml(entry.eligibilityReason || "")}</p>
            ${renderVersionTable(entry.versionDetails)}
            ${renderRepublishProgress(progress)}
          </div>`
        : ""
    }
  </article>`;
};

const renderToolbar = (resultId, featureState) => {
  const flowTypeSelected = Boolean(featureState.sourceFlowTypeKey);
  const flowSelected = Boolean(featureState.selectedFlowId);
  const searchEnabled = flowTypeSelected && flowSelected && !featureState.searching && !featureState.republishing;

  return `<div class="flow-dep-toolbar">
    ${renderGuxFieldSelect({
      escapeHtml,
      inputId: `${resultId}-flow-type`,
      className: "flow-dep-flow-type-select",
      label: "Flow Type",
      optionsHtml: `<option value="">Select Flow Type</option>${FLOW_TYPE_OPTIONS.map(
        (option) =>
          `<option value="${escapeHtml(option.key)}"${
            option.key === featureState.sourceFlowTypeKey ? " selected" : ""
          }>${escapeHtml(option.label)}</option>`
      ).join("")}`,
      attrs: `data-result-id="${escapeHtml(resultId)}"`,
    })}
    ${renderGuxFieldSelect({
      escapeHtml,
      inputId: `${resultId}-flow-id`,
      className: "flow-dep-flow-select",
      label: "Flow",
      optionsHtml: `<option value="">${
        featureState.loadingFlows ? "Loading flows..." : flowTypeSelected ? "Select Flow" : "Select a flow type first"
      }</option>${(featureState.flowOptions || [])
        .map(
          (option) =>
            `<option value="${escapeHtml(option.id)}"${
              option.id === featureState.selectedFlowId ? " selected" : ""
            }>${escapeHtml(option.name)}</option>`
        )
        .join("")}`,
      attrs: `data-result-id="${escapeHtml(resultId)}"${flowTypeSelected ? "" : " disabled"}`,
    })}
    <div class="flow-dep-toolbar__search">
      <gux-button type="button" accent="primary" data-flow-dep-action="search" data-result-id="${escapeHtml(resultId)}"${
        searchEnabled ? "" : " disabled"
      }>${featureState.searching ? "Searching..." : "Search"}</gux-button>
    </div>
  </div>`;
};

const renderSummaryBar = (resultId, featureState) => {
  const summary = featureState.summary;
  if (!summary) {
    return "";
  }

  const eligibleCount = Number(summary.republishEligible || 0);
  return `<div class="flow-dep-summary">
    <div class="flow-dep-summary__counts">
      <span><strong>${escapeHtml(summary.selectedFlowName)}</strong></span>
      <span>Dependent Flows: ${escapeHtml(summary.totalDependentFlows)}</span>
      <span>Active Dependencies: ${escapeHtml(summary.activeDependencies)}</span>
      <span>Republish Eligible: ${escapeHtml(summary.republishEligible)}</span>
    </div>
    ${
      eligibleCount
        ? `<gux-button type="button" accent="primary" data-flow-dep-action="republish-all" data-result-id="${escapeHtml(resultId)}"${
            featureState.republishing ? " disabled" : ""
          }>Republish All (${eligibleCount})</gux-button>`
        : ""
    }
  </div>`;
};

const renderResults = (resultId, featureState) => {
  if (featureState.phase !== "results") {
    return "";
  }

  const warning = featureState.warning
    ? `<p class="flow-dep-warning">${escapeHtml(featureState.warning)}</p>`
    : "";

  return `${warning}
    ${renderSummaryBar(resultId, featureState)}
    <div class="flow-dep-results">
      ${(featureState.activeResults || []).map((entry) => renderFlowCard(resultId, entry, featureState)).join("")}
      ${(featureState.inactiveResults || []).map((entry) => renderFlowCard(resultId, entry, featureState)).join("")}
    </div>`;
};

const createFlowDependencyFeature = ({
  state,
  requireCredentials,
  getCurrentAppDomain,
  startExportResult,
  finishExportResult,
  renderLoadingState,
  renderJsonBlock,
  confirmModal,
  summarizeBulkStatuses,
}) => {
  const renderFeatureBody = (resultId, featureState) =>
    `<div class="flow-dep-feature">
      ${renderToolbar(resultId, featureState)}
      ${
        featureState.searching
          ? renderLoadingState("Discovering dependencies...")
          : renderResults(resultId, featureState)
      }
    </div>`;

  const getExportMeta = (resultId) => state.exportData[resultId] || null;

  const setExportMeta = (resultId, exportMeta) => {
    state.exportData[resultId] = exportMeta;
  };

  const rerenderFeature = (resultId) => {
    const exportMeta = getExportMeta(resultId);
    if (!exportMeta) {
      return;
    }

    const resultEl = document.getElementById(resultId);
    if (!resultEl) {
      return;
    }

    const bodyEl = resultEl.querySelector(".export-results__body");
    if (bodyEl) {
      bodyEl.innerHTML = exportMeta.renderBody();
    }
  };

  const getEligibleResults = (featureState) =>
    (featureState.activeResults || []).filter((entry) => entry.eligibility === ELIGIBILITY.ELIGIBLE);

  const loadFlowsForType = async (resultId, featureState) => {
    const credentials = requireCredentials("Flow Dependencies");
    if (!credentials || !featureState.sourceFlowTypeKey) {
      return;
    }

    featureState.loadingFlows = true;
    featureState.flowOptions = [];
    featureState.selectedFlowId = "";
    rerenderFeature(resultId);

    try {
      featureState.flowOptions = await listArchitectFlowsByType({
        ...credentials,
        flowTypeKey: featureState.sourceFlowTypeKey,
      });
      featureState.selectedFlowId = featureState.flowOptions[0]?.id || "";
    } catch (error) {
      featureState.flowOptions = [];
      featureState.loadError = error.message || "Unable to load flows.";
    } finally {
      featureState.loadingFlows = false;
      rerenderFeature(resultId);
    }
  };

  const runDependencySearch = async (resultId, featureState) => {
    const credentials = requireCredentials("Flow Dependencies");
    if (!credentials) {
      return;
    }

    featureState.searching = true;
    featureState.phase = "setup";
    featureState.summary = null;
    featureState.activeResults = [];
    featureState.inactiveResults = [];
    featureState.warning = "";
    rerenderFeature(resultId);

    try {
      const payload = await discoverFlowDependencies({
        ...credentials,
        selectedFlowId: featureState.selectedFlowId,
        sourceFlowTypeKey: featureState.sourceFlowTypeKey,
        appDomain: getCurrentAppDomain?.() || "",
      });

      featureState.phase = "results";
      featureState.summary = payload.summary;
      featureState.warning = payload.warning || "";
      featureState.partialResults = Boolean(payload.partialResults);
      featureState.activeResults = payload.activeResults || [];
      featureState.inactiveResults = payload.inactiveResults || [];
      featureState.selectedFlow = payload.selectedFlow || null;
      featureState.sourceModule = getSourceModuleFromFeatureState({
        ...featureState,
        selectedFlow: payload.selectedFlow || null,
        summary: payload.summary || null,
      });
      featureState.expandedFlowIds = {};

      const exportMeta = getExportMeta(resultId);
      if (exportMeta) {
        exportMeta.status = `${payload.summary?.totalDependentFlows || 0} dependent flows found`;
        exportMeta.statusBase = exportMeta.status;
      }
    } catch (error) {
      featureState.phase = "setup";
      featureState.searchError = error.message || "Dependency discovery failed.";
    } finally {
      featureState.searching = false;
      rerenderFeature(resultId);
    }
  };

  const updateResultAfterRepublish = (featureState, flowId, result) => {
    const updateEntry = (entry) => {
      if (entry.flowId !== flowId) {
        return entry;
      }

      if (result.status === "success" && result.publishedVersionAfterRepublish) {
        return {
          ...entry,
          publishedVersionId: result.publishedVersionAfterRepublish,
          eligibility: ELIGIBILITY.ELIGIBLE,
          eligibilityReason: "Eligible for republish.",
        };
      }

      return entry;
    };

    featureState.activeResults = (featureState.activeResults || []).map(updateEntry);
    featureState.inactiveResults = (featureState.inactiveResults || []).map(updateEntry);
    featureState.republishProgressByFlowId[flowId] = result.stages || {};
  };

  const executeRepublish = async (resultId, featureState, targets) => {
    const credentials = requireCredentials("Flow Dependencies");
    if (!credentials || !targets.length) {
      return;
    }

    const sourceModule = getSourceModuleFromFeatureState(featureState);
    if (!sourceModule.id) {
      featureState.searchError = "The selected Common Module is required for republish validation.";
      rerenderFeature(resultId);
      return;
    }

    featureState.republishing = true;
    rerenderFeature(resultId);

    const rows = [];
    for (const target of targets) {
      featureState.republishProgressByFlowId[target.flowId] = {
        checkout: { status: "running" },
        validate: { status: "pending" },
        publish: { status: "pending" },
        complete: { status: "pending" },
      };
      featureState.expandedFlowIds[target.flowId] = true;
      rerenderFeature(resultId);

      try {
        const result = await republishFlow({
          ...credentials,
          flowId: target.flowId,
          flowTypeKey: target.flowTypeKey,
          sourceModule,
          sourceModuleId: sourceModule.id,
          sourceModuleName: sourceModule.name,
          sourceModuleVersion: sourceModule.version,
          selectedFlowId: sourceModule.id,
          selectedFlowName: sourceModule.name,
          onStage: ({ stages }) => {
            featureState.republishProgressByFlowId[target.flowId] = stages;
            rerenderFeature(resultId);
          },
        });
        updateResultAfterRepublish(featureState, target.flowId, result);
        rows.push({
          flowName: target.flowName,
          flowId: target.flowId,
          status: result.status,
          publishedVersionId: result.publishedVersionAfterRepublish || "",
          error: result.error || "",
        });
      } catch (error) {
        featureState.republishProgressByFlowId[target.flowId] = {
          checkout: { status: "failed", error: error.message },
          validate: { status: "pending" },
          publish: { status: "pending" },
          complete: { status: "failed", error: error.message },
        };
        rows.push({
          flowName: target.flowName,
          flowId: target.flowId,
          status: "failed",
          publishedVersionId: "",
          error: error.message || "Republish failed.",
        });
      }

      rerenderFeature(resultId);
    }

    featureState.republishing = false;
    rerenderFeature(resultId);

    if (rows.length > 1) {
      const summary = summarizeBulkStatuses(rows);
      const exportMeta = createFlowDependencyBulkResultsMeta(
        resultId,
        rows,
        "Flow Dependency Republish",
        `${summary.successCount} succeeded, ${summary.failureCount} failed`
      );
      exportMeta.renderBody = () => renderFeatureBody(resultId, featureState);
      finishExportResult(
        resultId,
        exportMeta.title,
        exportMeta.status,
        "",
        exportMeta
      );
    }
  };

  const wireButton = (button) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!state.hasConnection) {
        return;
      }

      const credentials = requireCredentials("Flow Dependencies");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Flow Dependencies",
        "Select a flow type and flow",
        renderLoadingState("Open the dependency discovery toolbar to begin.")
      );

      const featureState = defaultFeatureState();
      const exportMeta = {
        kind: "flow-dependency",
        resultId: loadingResultId,
        title: "Flow Dependencies",
        status: "Select a flow type and flow",
        exportType: "flow_dependency_discovery",
        hideActions: true,
        editable: false,
        featureState,
        renderBody: () => renderFeatureBody(loadingResultId, getExportMeta(loadingResultId)?.featureState || featureState),
      };

      setExportMeta(loadingResultId, exportMeta);
      finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
    });
  };

  const handleChange = async (event) => {
    const flowTypeChange = resolveDropdownChange(event.target, "flow-dep-flow-type-select");
    if (flowTypeChange) {
      const exportMeta = getExportMeta(flowTypeChange.resultId);
      if (!exportMeta?.featureState) {
        return false;
      }

      exportMeta.featureState.sourceFlowTypeKey = flowTypeChange.value;
      exportMeta.featureState.selectedFlowId = "";
      exportMeta.featureState.phase = "setup";
      exportMeta.featureState.summary = null;
      exportMeta.featureState.activeResults = [];
      exportMeta.featureState.inactiveResults = [];
      await loadFlowsForType(flowTypeChange.resultId, exportMeta.featureState);
      return true;
    }

    const flowChange = resolveDropdownChange(event.target, "flow-dep-flow-select");
    if (flowChange) {
      const exportMeta = getExportMeta(flowChange.resultId);
      if (!exportMeta?.featureState) {
        return false;
      }

      exportMeta.featureState.selectedFlowId = flowChange.value;
      exportMeta.featureState.phase = "setup";
      exportMeta.featureState.summary = null;
      exportMeta.featureState.activeResults = [];
      exportMeta.featureState.inactiveResults = [];
      rerenderFeature(flowChange.resultId);
      return true;
    }

    return false;
  };

  const handleClick = async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return false;
    }

    const actionEl = target.closest("[data-flow-dep-action]");
    if (!actionEl) {
      return false;
    }

    const resultId = actionEl.getAttribute("data-result-id") || "";
    const exportMeta = getExportMeta(resultId);
    const featureState = exportMeta?.featureState;
    if (!resultId || !featureState) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const action = actionEl.getAttribute("data-flow-dep-action");

    if (action === "search") {
      await runDependencySearch(resultId, featureState);
      return true;
    }

    if (action === "toggle-card") {
      const flowId = actionEl.getAttribute("data-flow-id") || "";
      featureState.expandedFlowIds[flowId] = !featureState.expandedFlowIds[flowId];
      rerenderFeature(resultId);
      return true;
    }

    if (action === "republish-one") {
      const flowId = actionEl.getAttribute("data-flow-id") || "";
      const entry = [...(featureState.activeResults || []), ...(featureState.inactiveResults || [])].find(
        (candidate) => candidate.flowId === flowId
      );
      if (!entry || entry.eligibility !== ELIGIBILITY.ELIGIBLE) {
        return true;
      }

      confirmModal.open({
        resultId,
        title: "Republish Flow",
        bodyHtml: `<p>Republish <strong>${escapeHtml(entry.flowName)}</strong>?</p>
          <p>Published version: v${escapeHtml(entry.publishedVersionId || "—")}</p>
          <p>Common Module: ${escapeHtml(featureState.summary?.selectedFlowName || featureState.selectedFlow?.name || "")}</p>
          <p class="muted">Checkout → Validate → Publish</p>`,
        confirmLabel: "Republish",
        onConfirm: async ({ close }) => {
          close();
          await executeRepublish(resultId, featureState, [entry]);
        },
      });
      return true;
    }

    if (action === "republish-all") {
      const eligible = getEligibleResults(featureState);
      const summary = featureState.summary || {};
      confirmModal.open({
        resultId,
        title: "Republish All Eligible Flows",
        bodyHtml: `<p>Eligible flows: ${eligible.length}</p>
          <p>Excluded:</p>
          <ul>
            <li>${escapeHtml(summary.newerUnpublished || 0)} newer unpublished version</li>
            <li>${escapeHtml(summary.historicalOnly || 0)} historical dependency only</li>
          </ul>
          <p><strong>${eligible.length}</strong> flow(s) will be republished.</p>`,
        confirmLabel: `Republish All (${eligible.length})`,
        onConfirm: async ({ close }) => {
          close();
          await executeRepublish(resultId, featureState, eligible);
        },
      });
      return true;
    }

    return true;
  };

  return {
    wireButton,
    handleClick,
    handleChange,
  };
};

export { createFlowDependencyFeature, ELIGIBILITY, FLOW_TYPE_OPTIONS };
