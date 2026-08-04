import {
  renderGuxFieldCheckbox,
  renderGuxFieldSelect,
  renderGuxFieldText,
  renderGuxTable,
  resolveDropdownChange,
} from "./gux-ui.js";
import {
  DEFAULT_SCHEDULE_NAMING_TEMPLATE,
  buildScheduleNameFromTemplate,
  renderScheduleNamingVariableHelp,
  resolveScheduleNamingTemplate,
} from "./schedule-naming-template.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createLoadSchedulesFeature = ({
  state,
  mapNamedOptions,
  getDivisions,
  getScheduleTemplates,
  loadSchedules,
  requireCredentials,
  startExportResult,
  finishExportResult,
  rerenderExportSection,
  renderLoadingState,
  renderJsonBlock,
  summarizeBulkStatuses,
  createLoadSchedulesResultsMeta,
  confirmModal,
}) => {
  const getDivisionOptionLabel = (divisionOptions, divisionId) =>
    (divisionOptions || []).find((option) => String(option.value) === String(divisionId || ""))?.label || "";

  const normalizeScheduleCatalog = (catalog) =>
    Object.entries(catalog || {})
      .map(([countryCode, countrySchedules]) => ({
        countryCode,
        schedules: Object.entries(countrySchedules || {})
          .map(([scheduleKey, schedule]) => ({
            id: `${countryCode}_${scheduleKey}`,
            scheduleKey,
            countryCode,
            sourceName: schedule?.name || scheduleKey,
            description: schedule?.description || "",
            start: schedule?.start || "",
            end: schedule?.end || "",
            rrule: schedule?.rrule || "",
          }))
          .sort((left, right) => String(left.sourceName || "").localeCompare(String(right.sourceName || ""))),
      }))
      .sort((left, right) => String(left.countryCode || "").localeCompare(String(right.countryCode || "")));

  const getSelectedSchedules = (scheduleState) =>
    Object.values(scheduleState.selectedSchedulesById || {}).sort((left, right) =>
      `${left.countryCode || ""}:${left.sourceName || ""}`.localeCompare(
        `${right.countryCode || ""}:${right.sourceName || ""}`
      )
    );

  const buildScheduleDisplayName = (scheduleState, schedule) =>
    buildScheduleNameFromTemplate(scheduleState, schedule, {
      getDivisionLabel: (state) =>
        getDivisionOptionLabel(state.divisionOptions, state.pendingDivisionId),
    });

  const getNamingPreviewSchedule = (scheduleState) =>
    getSelectedSchedules(scheduleState)[0] ||
    scheduleState.scheduleCountries?.[0]?.schedules?.[0] || {
      countryCode: "USA",
      sourceName: "Example Schedule",
      description: "Example description",
      scheduleKey: "example",
    };

  const updateNamingPreview = (resultId, scheduleState) => {
    const resultEl = document.getElementById(resultId);
    if (!resultEl) {
      return;
    }

    const previewEl = resultEl.querySelector(".schedule-naming-preview-value");
    if (!previewEl) {
      return;
    }

    previewEl.textContent = buildScheduleDisplayName(scheduleState, getNamingPreviewSchedule(scheduleState));
  };

  const toggleScheduleSelection = (scheduleState, scheduleId, checked) => {
    const schedule = (scheduleState.scheduleCountries || [])
      .flatMap((country) => country.schedules || [])
      .find((candidate) => String(candidate.id) === String(scheduleId));
    if (!schedule) {
      return;
    }

    if (checked) {
      scheduleState.selectedSchedulesById = {
        ...(scheduleState.selectedSchedulesById || {}),
        [schedule.id]: schedule,
      };
      return;
    }

    scheduleState.selectedSchedulesById = { ...(scheduleState.selectedSchedulesById || {}) };
    delete scheduleState.selectedSchedulesById[schedule.id];
  };

  const toggleCountryScheduleSelections = (scheduleState, countryCode, checked) => {
    const country = (scheduleState.scheduleCountries || []).find(
      (entry) => String(entry.countryCode) === String(countryCode)
    );
    if (!country) {
      return;
    }

    if (checked) {
      scheduleState.selectedSchedulesById = (country.schedules || []).reduce((selection, schedule) => {
        selection[schedule.id] = schedule;
        return selection;
      }, { ...(scheduleState.selectedSchedulesById || {}) });
      return;
    }

    scheduleState.selectedSchedulesById = { ...(scheduleState.selectedSchedulesById || {}) };
    (country.schedules || []).forEach((schedule) => {
      delete scheduleState.selectedSchedulesById[schedule.id];
    });
  };

  const scheduleCountryFlagCodes = {
    STD: "",
    USA: "US",
    CAN: "CA",
    MEX: "MX",
    GBR: "GB",
    FRA: "FR",
    DEU: "DE",
    IND: "IN",
    UKR: "UA",
  };

  const resolveCountryFlagCode = (countryCode) => {
    const normalized = String(countryCode || "").trim().toUpperCase();
    if (!normalized) {
      return "";
    }

    if (/^[A-Z]{2}$/.test(normalized)) {
      return normalized;
    }

    return scheduleCountryFlagCodes[normalized] || "";
  };

  const renderCountryFlagIcon = (countryCode) => {
    const flagCode = resolveCountryFlagCode(countryCode);
    if (!flagCode) {
      return "";
    }

    return `<gux-flag-icon-beta flag="${escapeHtml(flagCode)}" screenreader-text="${escapeHtml(
      String(countryCode || flagCode)
    )}"></gux-flag-icon-beta>`;
  };

  const renderCountrySchedulePanel = (resultId, scheduleState, country, selectedScheduleIds) => {
    const countrySchedules = country.schedules || [];
    const countryAllSelected =
      countrySchedules.length > 0 &&
      countrySchedules.every((schedule) => selectedScheduleIds.has(schedule.id));

    return `<gux-tab-advanced-panel tab-id="${escapeHtml(country.countryCode)}">
      <div class="bulk-schedule-country-panel">
        ${renderGuxFieldCheckbox({
          escapeHtml,
          className: "bulk-schedule-country-select-all",
          label: `Select All ${escapeHtml(country.countryCode)} (${countrySchedules.length})`,
          checked: countryAllSelected,
          attrs: `data-result-id="${escapeHtml(resultId)}" data-country-code="${escapeHtml(country.countryCode)}"`,
        })}
        ${renderGuxTable({
          columns: [
            { key: "select", header: "Select" },
            { key: "sourceName", header: "Name" },
            { key: "description", header: "Description" },
          ],
          rows: countrySchedules.length
            ? countrySchedules
            : [{ select: "", sourceName: "No schedules available.", description: "" }],
          renderCell: (column, schedule) => {
            if (column.key === "select" && schedule.id) {
              return renderGuxFieldCheckbox({
                escapeHtml,
                className: "bulk-schedule-checkbox",
                label: "",
                checked: selectedScheduleIds.has(schedule.id),
                attrs: `data-result-id="${escapeHtml(resultId)}" data-schedule-id="${escapeHtml(schedule.id)}"`,
                labelPosition: "screenreader",
              });
            }
            if (column.key === "select") {
              return "";
            }
            return escapeHtml(String(schedule[column.key] ?? ""));
          },
          escapeHtml,
          shell: true,
          emptyMessage: "No schedules available.",
        })}
      </div>
    </gux-tab-advanced-panel>`;
  };

  const renderScheduleLoadSelection = (resultId, scheduleState) => {
    const selectedSchedules = getSelectedSchedules(scheduleState);
    const selectedScheduleIds = new Set(selectedSchedules.map((schedule) => schedule.id));
    const scheduleCountries = scheduleState.scheduleCountries || [];
    const activeCountryCode =
      String(scheduleState.pendingCountryCode || "") ||
      String(scheduleCountries[0]?.countryCode || "");
    const divisionOptionsHtml = (scheduleState.divisionOptions || [])
      .map(
        (option) =>
          `<option value="${escapeHtml(option.value)}"${
            String(option.value) === String(scheduleState.pendingDivisionId || "") ? " selected" : ""
          }>${escapeHtml(option.label)}</option>`
      )
      .join("");
    const namingTemplate = resolveScheduleNamingTemplate(scheduleState);
    const namingControlsHtml = renderGuxFieldText({
      escapeHtml,
      inputId: `${resultId}-naming-template`,
      className: "bulk-schedule-naming-template",
      label: "Name template",
      value: namingTemplate,
      placeholder: DEFAULT_SCHEDULE_NAMING_TEMPLATE,
      attrs: `data-result-id="${escapeHtml(resultId)}" autocomplete="off" spellcheck="false"`,
    });
    const previewSchedule = getNamingPreviewSchedule(scheduleState);
    const previewName = buildScheduleDisplayName(scheduleState, previewSchedule);
    const countryTabsHtml = scheduleCountries.length
      ? `<gux-tabs-advanced class="bulk-schedule-country-tabs" active-tab="${escapeHtml(activeCountryCode)}" data-result-id="${escapeHtml(
          resultId
        )}">
          <gux-tab-advanced-list slot="tab-list">${scheduleCountries
            .map(
              (country) =>
                `<gux-tab-advanced tab-id="${escapeHtml(country.countryCode)}">
                  <span class="bulk-schedule-country-tab">
                    ${renderCountryFlagIcon(country.countryCode)}
                    <span class="bulk-schedule-country-tab__label">${escapeHtml(country.countryCode)} (${escapeHtml(
                      String((country.schedules || []).length)
                    )})</span>
                  </span>
                </gux-tab-advanced>`
            )
            .join("")}</gux-tab-advanced-list>
          ${scheduleCountries
            .map((country) =>
              renderCountrySchedulePanel(resultId, scheduleState, country, selectedScheduleIds)
            )
            .join("")}
        </gux-tabs-advanced>`
      : '<p class="muted">No schedule templates available.</p>';

    return `<div class="column-editor">
      <div class="column-editor__header">Load Schedules</div>
      <div class="sidebar-actions call-spoof-form">
        ${renderGuxFieldSelect({
          escapeHtml,
          inputId: `${resultId}-division-id`,
          className: "bulk-schedule-division-selection",
          label: "Division",
          optionsHtml: `<option value="">Select Division</option>${divisionOptionsHtml}`,
          attrs: `data-result-id="${escapeHtml(resultId)}"`,
        })}
        <div class="schedule-naming-convention">
          <div class="schedule-naming-convention__header">Naming Convention</div>
          <div class="schedule-naming-convention__template">${namingControlsHtml}</div>
          ${renderScheduleNamingVariableHelp(escapeHtml)}
          <p class="muted schedule-naming-preview">Preview: <span class="schedule-naming-preview-value">${escapeHtml(
            previewName || "Example name"
          )}</span></p>
        </div>
        <div class="bulk-control-row bulk-control-row--actions">
          <gux-button class="bulk-schedule-clear-selection" type="button" accent="secondary" data-result-id="${escapeHtml(
            resultId
          )}">Clear Selected</gux-button>
          <gux-button class="bulk-schedule-load-apply" type="button" accent="primary" data-result-id="${escapeHtml(
            resultId
          )}">Load Schedules</gux-button>
        </div>
        <p class="muted">Loaded ${escapeHtml(
          String(scheduleCountries.reduce((count, country) => count + (country.schedules || []).length, 0))
        )} schedule templates. Viewing ${escapeHtml(activeCountryCode || "country")}. Selected ${escapeHtml(
          String(selectedSchedules.length)
        )}.</p>
      </div>
    </div>
    <div class="bulk-schedule-tabs-container">${countryTabsHtml}</div>`;
  };

  const handleTabActivate = (event) => {
    const tabs = event.target instanceof HTMLElement ? event.target.closest(".bulk-schedule-country-tabs") : null;
    if (!tabs) {
      return false;
    }

    const resultId = tabs.getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    const nextCountryCode = String(event.detail || "");
    if (!resultId || !exportMeta || !nextCountryCode) {
      return true;
    }

    if (nextCountryCode === exportMeta.pendingCountryCode) {
      return true;
    }

    exportMeta.pendingCountryCode = nextCountryCode;
    rerenderExportSection(resultId);
    return true;
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const scheduleClearSelectionButton = target.closest(".bulk-schedule-clear-selection");
    if (scheduleClearSelectionButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = scheduleClearSelectionButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return true;
      }

      exportMeta.selectedSchedulesById = {};
      rerenderExportSection(resultId);
      return true;
    }

    const scheduleLoadApplyButton = target.closest(".bulk-schedule-load-apply");
    if (!scheduleLoadApplyButton) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const resultId = scheduleLoadApplyButton.getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    if (!resultId || !exportMeta) {
      return true;
    }

    const selectedSchedules = getSelectedSchedules(exportMeta);
    if (!exportMeta.pendingDivisionId) {
      confirmModal.open({
        resultId,
        title: "Division Required",
        bodyHtml: "<p>Select a division before loading schedules.</p>",
        confirmHidden: true,
        cancelLabel: "Close",
      });
      return true;
    }

    if (selectedSchedules.length === 0) {
      confirmModal.open({
        resultId,
        title: "No Schedules Selected",
        bodyHtml: "<p>Select at least one schedule before loading.</p>",
        confirmHidden: true,
        cancelLabel: "Close",
      });
      return true;
    }

    const emptyNameSchedule = selectedSchedules.find(
      (schedule) => !buildScheduleDisplayName(exportMeta, schedule)
    );
    if (emptyNameSchedule) {
      confirmModal.open({
        resultId,
        title: "Naming Convention Invalid",
        bodyHtml:
          "<p>The name template produced an empty name for at least one selected schedule. Add placeholders or literal text.</p>",
        confirmHidden: true,
        cancelLabel: "Close",
      });
      return true;
    }

    const credentials = requireCredentials("Load Schedules");
    if (!credentials) {
      return true;
    }

    const divisionName = getDivisionOptionLabel(exportMeta.divisionOptions, exportMeta.pendingDivisionId);
    const schedulesToCreate = selectedSchedules.map((schedule) => ({
      scheduleKey: schedule.id,
      countryCode: schedule.countryCode,
      sourceName: schedule.sourceName,
      requestedName: buildScheduleDisplayName(exportMeta, schedule),
      name: buildScheduleDisplayName(exportMeta, schedule),
      description: schedule.description || "",
      start: schedule.start,
      end: schedule.end,
      ...(schedule.rrule ? { rrule: schedule.rrule } : {}),
      division: { id: exportMeta.pendingDivisionId },
    }));

    const namingTemplate = resolveScheduleNamingTemplate(exportMeta);
    confirmModal.open({
      resultId,
      title: "Confirm Schedule Load",
      bodyHtml: `<p>Load ${escapeHtml(selectedSchedules.length)} schedules into ${escapeHtml(
        divisionName || exportMeta.pendingDivisionId
      )}.</p><p>Name template: <code>${escapeHtml(namingTemplate)}</code></p>`,
      confirmLabel: "Load Schedules",
      onConfirm: async ({ resultId, close }) => {
        const exportMeta = resultId ? state.exportData[resultId] : null;
        const resultEl = resultId ? document.getElementById(resultId) : null;
        if (!resultId || !exportMeta || !resultEl) {
          close();
          return;
        }

        close();
        resultEl.querySelector(".export-results__body").innerHTML = renderLoadingState(
          `Loading ${schedulesToCreate.length} schedules...`
        );

        try {
          const results = await loadSchedules({
            ...credentials,
            schedules: schedulesToCreate,
          });
          const resultRows = schedulesToCreate.map((schedule) => {
            const scheduleResult = results.find((entry) => entry.scheduleKey === schedule.scheduleKey);
            return {
              requestedName: schedule.requestedName,
              countryCode: schedule.countryCode,
              sourceName: schedule.sourceName,
              scheduleId: scheduleResult?.scheduleId || "",
              scheduleName: scheduleResult?.scheduleName || schedule.requestedName,
              status: scheduleResult?.status || "unknown",
              error: scheduleResult?.error || "",
            };
          });
          const status = summarizeBulkStatuses(resultRows);

          finishExportResult(
            resultId,
            "Load Schedules",
            status,
            "",
            createLoadSchedulesResultsMeta(resultId, resultRows, "Load Schedules", status)
          );
        } catch (error) {
          finishExportResult(
            resultId,
            "Load Schedules",
            error.message || "Load schedules failed",
            renderJsonBlock(error.payload || { error: error.message || "Load schedules failed" })
          );
        }
      },
    });

    return true;
  };

  const updateNamingTemplate = (resultId, exportMeta, templateValue) => {
    exportMeta.namingTemplate = templateValue;
    updateNamingPreview(resultId, exportMeta);
  };

  const handleInput = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains("bulk-schedule-naming-template")) {
      return false;
    }

    const resultId = target.getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    if (!resultId || !exportMeta) {
      return false;
    }

    updateNamingTemplate(resultId, exportMeta, target.value);
    return true;
  };

  const handleChange = (event) => {
    const target = event.target;

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-schedule-checkbox")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      const scheduleId = target.getAttribute("data-schedule-id");
      if (!resultId || !exportMeta || !scheduleId) {
        return false;
      }

      toggleScheduleSelection(exportMeta, scheduleId, target.checked);
      rerenderExportSection(resultId);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-schedule-country-select-all")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      const countryCode = target.getAttribute("data-country-code");
      if (!resultId || !exportMeta || !countryCode) {
        return false;
      }

      toggleCountryScheduleSelections(exportMeta, countryCode, target.checked);
      rerenderExportSection(resultId);
      return true;
    }

    const divisionChange = resolveDropdownChange(target, "bulk-schedule-division-selection");
    if (divisionChange) {
      const exportMeta = divisionChange.resultId ? state.exportData[divisionChange.resultId] : null;
      if (!divisionChange.resultId || !exportMeta) {
        return false;
      }

      exportMeta.pendingDivisionId = divisionChange.value;
      rerenderExportSection(divisionChange.resultId);
      return true;
    }

    if (target instanceof HTMLInputElement && target.classList.contains("bulk-schedule-naming-template")) {
      const resultId = target.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return false;
      }

      updateNamingTemplate(resultId, exportMeta, target.value);
      return true;
    }

    return false;
  };

  const wireButton = (button) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!state.hasConnection) {
        return;
      }

      const credentials = requireCredentials("Load Schedules");
      if (!credentials) {
        return;
      }

      const loadingResultId = startExportResult(
        "Load Schedules",
        "Loading schedule templates...",
        renderLoadingState("Fetching divisions and schedule templates...")
      );

      try {
        const [divisions, scheduleCatalog] = await Promise.all([
          getDivisions(credentials),
          getScheduleTemplates(),
        ]);
        let scheduleMeta = {
          resultId: loadingResultId,
          title: "Load Schedules",
          status: "Select a division, naming convention, and schedules.",
          exportType: "load_schedules_setup",
          kind: "bulk-load-schedules",
          editable: false,
          divisionOptions: mapNamedOptions(divisions),
          pendingDivisionId: "",
          pendingCountryCode: "",
          namingTemplate: DEFAULT_SCHEDULE_NAMING_TEMPLATE,
          scheduleCountries: normalizeScheduleCatalog(scheduleCatalog),
          selectedSchedulesById: {},
        };
        const firstCountryCode = scheduleMeta.scheduleCountries[0]?.countryCode || "";
        scheduleMeta.pendingCountryCode = firstCountryCode;
        scheduleMeta.renderBody = () =>
          renderScheduleLoadSelection(loadingResultId, state.exportData[loadingResultId] || scheduleMeta);

        state.exportData[loadingResultId] = scheduleMeta;
        finishExportResult(
          loadingResultId,
          "Load Schedules",
          scheduleMeta.status,
          "",
          scheduleMeta
        );
      } catch (error) {
        finishExportResult(
          loadingResultId,
          "Load Schedules",
          error.message || "Schedule loader setup failed",
          renderJsonBlock(error.payload || { error: error.message || "Schedule loader setup failed" })
        );
      }
    });
  };

  return {
    buildScheduleDisplayName,
    getSelectedSchedules,
    handleChange,
    handleClick,
    handleInput,
    handleTabActivate,
    renderScheduleLoadSelection,
    wireButton,
  };
};

export { createLoadSchedulesFeature };
