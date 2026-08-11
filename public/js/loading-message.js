const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const DEFAULT_GUIDANCE = "This may take a few moments. Please stay on this page.";

const normalizeLoadingConfig = (messageOrOptions, options = {}) => {
  if (typeof messageOrOptions === "object" && messageOrOptions !== null && !Array.isArray(messageOrOptions)) {
    return {
      primaryMessage: "Processing your data...",
      additionalGuidance: DEFAULT_GUIDANCE,
      value: undefined,
      max: undefined,
      compact: false,
      className: "",
      ...messageOrOptions,
    };
  }

  return {
    primaryMessage: String(messageOrOptions || "Processing your data..."),
    additionalGuidance: options.additionalGuidance ?? DEFAULT_GUIDANCE,
    value: options.value,
    max: options.max,
    compact: options.compact ?? false,
    className: options.className ?? "",
    ...options,
  };
};

const renderLoadingState = (messageOrOptions, options = {}) => {
  const config = normalizeLoadingConfig(messageOrOptions, options);
  const { primaryMessage, additionalGuidance, value, max, compact, className } = config;

  const hasProgress = Number.isFinite(Number(max)) && Number(max) > 0 && Number.isFinite(Number(value));
  const safeMax = hasProgress ? Number(max) : 0;
  const safeValue = hasProgress ? Math.max(0, Math.min(Number(value), safeMax)) : 0;
  const percent = hasProgress ? Math.round((safeValue / safeMax) * 100) : null;
  const screenreaderText = hasProgress ? `Loading is ${percent}% complete` : "Loading";

  const progressAttrs = hasProgress
    ? `value="${escapeHtml(String(safeValue))}" max="${escapeHtml(String(safeMax))}"`
    : "";

  const guidanceSlot = additionalGuidance
    ? `<div slot="additional-guidance">${escapeHtml(additionalGuidance)}</div>`
    : "";

  const panelClasses = ["export-loading-panel", compact ? "export-loading-panel--compact" : "", className]
    .filter(Boolean)
    .join(" ");

  return `<div class="${panelClasses}">
    <gux-loading-message class="export-loading-panel__message">
      <div slot="primary-message">${escapeHtml(primaryMessage)}</div>
      ${guidanceSlot}
      <gux-radial-progress slot="progress" ${progressAttrs} screenreader-text="${escapeHtml(screenreaderText)}"></gux-radial-progress>
    </gux-loading-message>
  </div>`;
};

const updateLoadingProgress = (rootEl, { value, max, primaryMessage, additionalGuidance } = {}) => {
  if (!rootEl) {
    return;
  }

  const panel = rootEl.classList?.contains("export-loading-panel")
    ? rootEl
    : rootEl.querySelector(".export-loading-panel");

  if (!panel) {
    return;
  }

  const progressEl = panel.querySelector("gux-radial-progress");
  const primaryEl = panel.querySelector('[slot="primary-message"]');
  const guidanceEl = panel.querySelector('[slot="additional-guidance"]');

  if (progressEl && Number.isFinite(Number(max)) && Number(max) > 0) {
    const safeMax = Number(max);
    const safeValue = Math.max(0, Math.min(Number(value) || 0, safeMax));
    progressEl.setAttribute("value", String(safeValue));
    progressEl.setAttribute("max", String(safeMax));
    const percent = Math.round((safeValue / safeMax) * 100);
    progressEl.setAttribute("screenreader-text", `Loading is ${percent}% complete`);
  }

  if (primaryEl && primaryMessage != null) {
    primaryEl.textContent = primaryMessage;
  }

  if (guidanceEl && additionalGuidance != null) {
    guidanceEl.textContent = additionalGuidance;
  }
};

export { renderLoadingState, updateLoadingProgress };
