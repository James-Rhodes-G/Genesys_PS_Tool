import { renderGuxFieldSelect, resolveDropdownChange } from "./gux-ui.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createIntentHealthFeature = ({
  state,
  getBotFlows,
  getIntentHealth,
  mapBotFlowOptions,
  getSelectedBotFlow,
  validatePublishedBotFlow,
  requireCredentials,
  startExportResult,
  finishExportResult,
  renderLoadingState,
  renderJsonBlock,
  createIntentHealthResultsMeta,
  renderEditableTableContent,
}) => {
  const normalizeIntentRows = (health) =>
    Array.isArray(health?.intents)
      ? health.intents.map((intent) => ({
          intentId: intent.id || "",
          name: intent.name || "",
          languageHealth: intent.languageHealth
            ? Object.entries(intent.languageHealth)
                .map(([language, value]) => `${language}: ${JSON.stringify(value)}`)
                .join(" | ")
            : "",
        }))
      : [];

  const renderSetup = (resultId, featureState) => {
    const flowOptions = featureState.flowOptions || [];
    const selectedFlowId = String(featureState.selectedFlowId || "");

    return `<div class="column-editor">
      <div class="column-editor__header">Intent Health</div>
      <div class="sidebar-actions">
        ${renderGuxFieldSelect({
          escapeHtml,
          inputId: `${resultId}-intent-health-flow`,
          className: "intent-health-flow-select",
          label: "Bot Flow",
          optionsHtml: `<option value="">Select bot flow</option>${flowOptions
            .map(
              (option) =>
                `<option value="${escapeHtml(option.value)}"${
                  option.value === selectedFlowId ? " selected" : ""
                }>${escapeHtml(option.label)}</option>`
            )
            .join("")}`,
          attrs: `data-result-id="${escapeHtml(resultId)}"`,
        })}
        <div class="bulk-control-row bulk-control-row--actions">
          <gux-button class="intent-health-load" type="button" accent="primary" data-result-id="${escapeHtml(
            resultId
          )}">Load Intent Health</gux-button>
        </div>
      </div>
    </div>`;
  };

  const loadIntentHealth = async (resultId, featureState) => {
    const credentials = requireCredentials("Intent Health");
    const resultEl = resultId ? document.getElementById(resultId) : null;
    if (!credentials || !resultEl) {
      return;
    }

    const selectedFlow = getSelectedBotFlow(featureState.flowOptions, featureState.selectedFlowId);
    const validationMessage = validatePublishedBotFlow(selectedFlow);
    if (validationMessage) {
      finishExportResult(
        resultId,
        "Intent Health",
        validationMessage,
        `<p class="muted">${escapeHtml(validationMessage)}</p>`,
        {
          ...featureState,
          resultId,
          title: "Intent Health",
          status: validationMessage,
          renderBody: () => renderSetup(resultId, featureState),
        }
      );
      return;
    }

    resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
      `Loading intent health for ${selectedFlow.flowName}...`
    );

    try {
      const health = await getIntentHealth({
        ...credentials,
        flowId: selectedFlow.value,
        versionId: selectedFlow.versionId,
      });
      const rows = normalizeIntentRows(health);
      const status = `Loaded ${rows.length} intents for ${selectedFlow.flowName}`;
      const exportMeta = createIntentHealthResultsMeta(resultId, rows, "Intent Health", status);
      exportMeta.flowId = selectedFlow.value;
      exportMeta.flowName = selectedFlow.flowName;
      exportMeta.flowOptions = featureState.flowOptions;
      exportMeta.selectedFlowId = selectedFlow.value;
      exportMeta.renderBody = () =>
        `${renderSetup(resultId, exportMeta)}${rows.length ? renderEditableTableContent(resultId) : exportMeta.emptyHtml || '<p class="muted">No intents found.</p>'}`;
      finishExportResult(resultId, "Intent Health", status, "", exportMeta);
    } catch (error) {
      finishExportResult(
        resultId,
        "Intent Health",
        error.message || "Intent health request failed",
        renderJsonBlock(error.payload || { error: error.message || "Intent health request failed" })
      );
    }
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const loadButton = target.closest(".intent-health-load");
    if (!loadButton) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const resultId = loadButton.getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    if (!resultId || !exportMeta) {
      return true;
    }

    await loadIntentHealth(resultId, exportMeta);
    return true;
  };

  const handleChange = (event) => {
    const flowChange = resolveDropdownChange(event.target, "intent-health-flow-select");
    if (!flowChange) {
      return false;
    }

    const exportMeta = flowChange.resultId ? state.exportData[flowChange.resultId] : null;
    if (!flowChange.resultId || !exportMeta) {
      return false;
    }

    exportMeta.selectedFlowId = flowChange.value;
    return true;
  };

  const wireButton = (button) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!state.hasConnection) {
        return;
      }

      const credentials = requireCredentials("Intent Health");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Intent Health",
        "Loading bot flows...",
        renderLoadingState('Fetching "/api/v2/flows?type=bot,digitalbot"...')
      );

      try {
        const flows = await getBotFlows(credentials);
        const flowOptions = mapBotFlowOptions(flows);
        const exportMeta = {
          resultId: loadingResultId,
          title: "Intent Health",
          status: "Select a bot flow",
          exportType: "intent_health_setup",
          kind: "intent-health",
          hideActions: true,
          editable: false,
          flowOptions,
          selectedFlowId: flowOptions[0]?.value || "",
          renderBody: () => renderSetup(loadingResultId, state.exportData[loadingResultId] || exportMeta),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Intent Health",
          error.message || "Bot flow lookup failed",
          renderJsonBlock(error.payload || { error: error.message || "Bot flow lookup failed" })
        );
      }
    });
  };

  return {
    handleClick,
    handleChange,
    wireButton,
  };
};

export { createIntentHealthFeature };
