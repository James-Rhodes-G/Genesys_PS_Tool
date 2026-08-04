import { renderGuxFieldSelect, resolveDropdownChange, readControlValue } from "./gux-ui.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createUtterancesFeature = ({
  state,
  getBotFlows,
  getBotUtterances,
  mapBotFlowOptions,
  getSelectedBotFlow,
  validatePublishedBotFlow,
  requireCredentials,
  startExportResult,
  finishExportResult,
  renderLoadingState,
  renderJsonBlock,
  createUtterancesResultsMeta,
  getCurrentAppDomain,
  renderEditableTableContent,
}) => {
  const normalizeUtteranceRows = (entities, flowId, flowName) =>
    (entities || []).map((utterance) => {
      const askAction = utterance.askAction || null;
      const sessionEndDetails = utterance.sessionEndDetails || null;

      return {
        flowId,
        flowName,
        conversationId: utterance.conversation?.id || "",
        sessionId: utterance.sessionId || "",
        dateCompleted: utterance.dateCompleted || "",
        userInput: utterance.userInput || "",
        botPrompts: Array.isArray(utterance.botPrompts)
          ? utterance.botPrompts.join(" | ")
          : utterance.botPrompts || "",
        actionId: askAction?.actionId || "",
        actionNumber: askAction?.actionNumber || sessionEndDetails?.type || "",
        actionType: askAction?.actionType || sessionEndDetails?.type || "",
        askActionResult: utterance.askActionResult || "",
      };
    });

  const renderSetup = (resultId, featureState) => {
    const flowOptions = featureState.flowOptions || [];
    const selectedFlowId = String(featureState.selectedFlowId || "");
    const filterSummary = featureState.filterSummary || "";

    return `<div class="column-editor">
      <div class="column-editor__header">Bot Utterances</div>
      ${filterSummary ? `<p class="muted">${escapeHtml(filterSummary)}</p>` : ""}
      <div class="sidebar-actions">
        ${renderGuxFieldSelect({
          escapeHtml,
          inputId: `${resultId}-utterances-flow`,
          className: "utterances-flow-select",
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
          <gux-button class="utterances-load" type="button" accent="primary" data-result-id="${escapeHtml(
            resultId
          )}">Load Utterances</gux-button>
          ${
            featureState.filters && Object.keys(featureState.filters).length
              ? `<gux-button class="utterances-clear-filters" type="button" accent="secondary" data-result-id="${escapeHtml(
                  resultId
                )}">Clear Filters</gux-button>`
              : ""
          }
          ${
            featureState.nextPageNumber
              ? `<gux-button class="utterances-next-page" type="button" accent="secondary" data-result-id="${escapeHtml(
                  resultId
                )}" data-page-number="${escapeHtml(String(featureState.nextPageNumber))}">Next Page</gux-button>`
              : ""
          }
        </div>
      </div>
    </div>`;
  };

  const buildFilterSummary = (filters = {}) => {
    const parts = [];
    if (filters.sessionId) {
      parts.push(`sessionId=${filters.sessionId}`);
    }
    if (filters.askActionId) {
      parts.push(`askActionId=${filters.askActionId}`);
    }
    if (filters.askActionResults) {
      parts.push(`askActionResults=${filters.askActionResults}`);
    }
    if (filters.pageNumber) {
      parts.push(`page=${filters.pageNumber}`);
    }
    return parts.length ? `Filters: ${parts.join(", ")}` : "";
  };

  const loadUtterances = async (resultId, featureState, overrides = {}) => {
    const credentials = requireCredentials("Bot Utterances");
    const resultEl = resultId ? document.getElementById(resultId) : null;
    if (!credentials || !resultEl) {
      return;
    }

    const nextFeatureState = {
      ...featureState,
      selectedFlowId: overrides.selectedFlowId ?? featureState.selectedFlowId,
      filters: overrides.filters ?? featureState.filters ?? {},
    };

    const selectedFlow = getSelectedBotFlow(nextFeatureState.flowOptions, nextFeatureState.selectedFlowId);
    const validationMessage = validatePublishedBotFlow(selectedFlow);
    if (validationMessage) {
      finishExportResult(
        resultId,
        "Bot Utterances",
        validationMessage,
        `<p class="muted">${escapeHtml(validationMessage)}</p>`,
        {
          ...nextFeatureState,
          resultId,
          title: "Bot Utterances",
          status: validationMessage,
          filterSummary: buildFilterSummary(nextFeatureState.filters),
          renderBody: () => renderSetup(resultId, nextFeatureState),
        }
      );
      return;
    }

    resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
      `Loading utterances for ${selectedFlow.flowName}...`
    );

    try {
      const payload = await getBotUtterances({
        ...credentials,
        flowId: selectedFlow.value,
        filters: nextFeatureState.filters,
      });
      const rows = normalizeUtteranceRows(payload.entities, selectedFlow.value, selectedFlow.flowName);
      const status = `Loaded ${rows.length} utterances for ${selectedFlow.flowName}`;
      const nextPageNumber = payload.nextUri ? Number(nextFeatureState.filters?.pageNumber || 1) + 1 : null;
      const exportMeta = createUtterancesResultsMeta(
        resultId,
        rows,
        "Bot Utterances",
        status,
        getCurrentAppDomain(),
        selectedFlow.value,
        selectedFlow.flowName
      );

      Object.assign(exportMeta, {
        flowOptions: nextFeatureState.flowOptions,
        selectedFlowId: selectedFlow.value,
        filters: nextFeatureState.filters,
        filterSummary: buildFilterSummary(nextFeatureState.filters),
        nextPageNumber,
        renderBody: () =>
          `${renderSetup(resultId, exportMeta)}${rows.length ? renderEditableTableContent(resultId) : exportMeta.emptyHtml || '<p class="muted">No utterances found.</p>'}`,
      });

      finishExportResult(resultId, "Bot Utterances", status, "", exportMeta);
    } catch (error) {
      finishExportResult(
        resultId,
        "Bot Utterances",
        error.message || "Utterances request failed",
        renderJsonBlock(error.payload || { error: error.message || "Utterances request failed" })
      );
    }
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const filterLink = target.closest(".utterance-filter-link");
    if (filterLink) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = filterLink.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return true;
      }

      const filters = { ...(exportMeta.filters || {}) };
      const filterKey = filterLink.getAttribute("data-filter-key");
      const filterValue = filterLink.getAttribute("data-filter-value");
      if (filterKey && filterValue) {
        filters[filterKey] = filterValue;
      }
      delete filters.pageNumber;

      await loadUtterances(resultId, exportMeta, { filters });
      return true;
    }

    const clearFiltersButton = target.closest(".utterances-clear-filters");
    if (clearFiltersButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = clearFiltersButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return true;
      }

      await loadUtterances(resultId, exportMeta, { filters: {} });
      return true;
    }

    const nextPageButton = target.closest(".utterances-next-page");
    if (nextPageButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = nextPageButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      const pageNumber = Number(nextPageButton.getAttribute("data-page-number") || "");
      if (!resultId || !exportMeta || !pageNumber) {
        return true;
      }

      await loadUtterances(resultId, exportMeta, {
        filters: {
          ...(exportMeta.filters || {}),
          pageNumber,
        },
      });
      return true;
    }

    const loadButton = target.closest(".utterances-load");
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

    await loadUtterances(resultId, exportMeta, { filters: {} });
    return true;
  };

  const handleChange = (event) => {
    const flowChange = resolveDropdownChange(event.target, "utterances-flow-select");
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

      const credentials = requireCredentials("Bot Utterances");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Bot Utterances",
        "Loading bot flows...",
        renderLoadingState('Fetching "/api/v2/flows?type=bot,digitalbot"...')
      );

      try {
        const flows = await getBotFlows(credentials);
        const flowOptions = mapBotFlowOptions(flows);
        const exportMeta = {
          resultId: loadingResultId,
          title: "Bot Utterances",
          status: "Select a bot flow",
          exportType: "utterances_setup",
          kind: "utterances",
          hideActions: true,
          editable: false,
          flowOptions,
          selectedFlowId: flowOptions[0]?.value || "",
          filters: {},
          filterSummary: "",
          renderBody: () => renderSetup(loadingResultId, state.exportData[loadingResultId] || exportMeta),
        };

        state.exportData[loadingResultId] = exportMeta;
        finishExportResult(loadingResultId, exportMeta.title, exportMeta.status, "", exportMeta);
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Bot Utterances",
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

export { createUtterancesFeature };
