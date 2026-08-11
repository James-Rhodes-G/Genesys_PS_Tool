import { appendUserCacheStatus, formatUserCacheTimestamp } from "./session-store.js";

import { renderLoadingState } from "./loading-message.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderExportProgressState = ({ message, current, total, resultId, cancellable = false }) => {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeCurrent = Math.max(0, Math.min(Number(current) || 0, safeTotal || Number(current) || 0));
  const percent = safeTotal > 0 ? Math.round((safeCurrent / safeTotal) * 100) : 0;
  const detail =
    safeTotal > 0
      ? `${safeCurrent} / ${safeTotal} users (${percent}%)`
      : "Preparing user data...";

  const cancelButtonHtml =
    cancellable && resultId
      ? `<div class="export-progress__actions">
          <gux-button
            class="export-progress-cancel"
            type="button"
            accent="secondary"
            data-result-id="${escapeHtml(resultId)}"
          >Cancel Export</gux-button>
        </div>`
      : "";

  return `<div class="export-progress">
    ${renderLoadingState({
      primaryMessage: message || "Loading...",
      additionalGuidance: detail,
      value: safeTotal > 0 ? safeCurrent : undefined,
      max: safeTotal > 0 ? safeTotal : undefined,
    })}
    ${cancelButtonHtml}
  </div>`;
};

const buildProgressiveExportStatusParts = (rows, { cancelled = false, totalUsers = 0 } = {}) => {
  const failedCount = rows.filter((row) => row.status === "failed").length;
  const failureSuffix = failedCount > 0 ? `, ${failedCount} lookup failure(s)` : "";

  if (cancelled) {
    if (totalUsers > 0) {
      return `Cancelled — showing ${rows.length} of ${totalUsers} users${failureSuffix}`;
    }

    return `Cancelled — showing ${rows.length} users${failureSuffix}`;
  }

  if (failedCount > 0) {
    return `Loaded ${rows.length} users${failureSuffix}`;
  }

  return `Loaded ${rows.length} users`;
};

const buildProgressiveExportStatus = (rows, { cancelled = false, totalUsers = 0, userCache = null } = {}) =>
  appendUserCacheStatus(
    buildProgressiveExportStatusParts(rows, { cancelled, totalUsers }),
    userCache
  );

const renderUserCacheRefreshLink = (resultId, userCache) => {
  const timestamp = formatUserCacheTimestamp(userCache?.syncedAt);
  if (!timestamp) {
    return "";
  }

  const label = userCache.fromCache ? "cached" : "synced";
  return `<a href="#" class="user-cache-refresh" role="button" data-result-id="${escapeHtml(
    resultId
  )}" title="Click to refresh data">${escapeHtml(label)} ${escapeHtml(timestamp)}</a>`;
};

const renderExportSummaryStatus = (resultId, exportMeta) => {
  const baseStatus = exportMeta?.statusBase || exportMeta?.status || "";
  if (!exportMeta?.userCache?.syncedAt) {
    return escapeHtml(baseStatus);
  }

  return `${escapeHtml(baseStatus)} — ${renderUserCacheRefreshLink(resultId, exportMeta.userCache)}`;
};

const findClickControl = (event, className) => {
  if (typeof event.composedPath === "function") {
    for (const node of event.composedPath()) {
      if (node instanceof HTMLElement && node.classList.contains(className)) {
        return node;
      }
    }
  }

  const target = event.target;
  return target instanceof HTMLElement ? target.closest(`.${className}`) : null;
};

export {
  buildProgressiveExportStatus,
  buildProgressiveExportStatusParts,
  findClickControl,
  renderExportProgressState,
  renderExportSummaryStatus,
};
