const DEFAULT_SCHEDULE_NAMING_TEMPLATE = "{{division}}_{{country}}-{{name}}";

const SCHEDULE_NAMING_VARIABLES = [
  { key: "division", description: "Selected division name" },
  { key: "divisionId", description: "Selected division ID" },
  { key: "country", description: "Schedule country code" },
  { key: "name", description: "Source schedule name" },
  { key: "description", description: "Schedule description" },
  { key: "scheduleKey", description: "Template schedule key" },
  { key: "date", description: "Today's date (YYYY-MM-DD)" },
  { key: "dateCompact", description: "Today's date (YYYYMMDD)" },
  { key: "year", description: "Current year" },
  { key: "month", description: "Current month (01-12)" },
  { key: "day", description: "Current day (01-31)" },
];

const padDatePart = (value) => String(value).padStart(2, "0");

const buildScheduleNamingContext = (scheduleState, schedule, { getDivisionLabel, now = new Date() } = {}) => {
  const divisionLabel =
    typeof getDivisionLabel === "function"
      ? getDivisionLabel(scheduleState)
      : String(scheduleState?.pendingDivisionId || "");

  return {
    division: divisionLabel,
    divisionId: String(scheduleState?.pendingDivisionId || ""),
    country: String(schedule?.countryCode || ""),
    name: String(schedule?.sourceName || ""),
    description: String(schedule?.description || ""),
    scheduleKey: String(schedule?.scheduleKey || ""),
    date: `${now.getFullYear()}-${padDatePart(now.getMonth() + 1)}-${padDatePart(now.getDate())}`,
    dateCompact: `${now.getFullYear()}${padDatePart(now.getMonth() + 1)}${padDatePart(now.getDate())}`,
    year: String(now.getFullYear()),
    month: padDatePart(now.getMonth() + 1),
    day: padDatePart(now.getDate()),
  };
};

const resolveScheduleNamingTemplate = (scheduleState) => {
  if (scheduleState?.namingTemplate != null && String(scheduleState.namingTemplate).trim() !== "") {
    return String(scheduleState.namingTemplate);
  }

  const namingOrder = Array.isArray(scheduleState?.namingOrder) ? scheduleState.namingOrder : [];
  const parts = namingOrder.map((part) => String(part || "").trim()).filter(Boolean);
  if (parts.length) {
    return parts.map((part) => `{{${part}}}`).join("_");
  }

  return DEFAULT_SCHEDULE_NAMING_TEMPLATE;
};

const renderScheduleNamingTemplate = (template, context) =>
  String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = context[key];
    return value == null ? "" : String(value);
  });

const buildScheduleNameFromTemplate = (scheduleState, schedule, options = {}) => {
  const template = resolveScheduleNamingTemplate(scheduleState);
  const context = buildScheduleNamingContext(scheduleState, schedule, options);
  return renderScheduleNamingTemplate(template, context).trim();
};

const renderScheduleNamingVariableHelp = (escapeHtml) =>
  `<p class="muted schedule-naming-variables">Use Mustache-style placeholders: ${SCHEDULE_NAMING_VARIABLES.map(
    (variable) => `<code>{{${escapeHtml(variable.key)}}}</code>`
  ).join(", ")}</p>`;

export {
  DEFAULT_SCHEDULE_NAMING_TEMPLATE,
  SCHEDULE_NAMING_VARIABLES,
  buildScheduleNameFromTemplate,
  buildScheduleNamingContext,
  renderScheduleNamingTemplate,
  renderScheduleNamingVariableHelp,
  resolveScheduleNamingTemplate,
};
