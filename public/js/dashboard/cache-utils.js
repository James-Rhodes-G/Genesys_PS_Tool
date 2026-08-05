const formatCacheAge = (cachedAt) => {
  if (!cachedAt) {
    return "";
  }

  const deltaMs = Date.now() - cachedAt;
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const formatTimestamp = (value) => {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderStatusBadge = (status) => {
  const normalized = String(status || "not-loaded").toLowerCase();
  const className = `dashboard-status dashboard-status--${normalized.replace(/\s+/g, "-")}`;
  return `<span class="${className}">${escapeHtml(status)}</span>`;
};

const renderCacheStatus = ({ status, cachedAt, liveUpdatedAt }) => {
  if (status === "Cached" && cachedAt) {
    return `${renderStatusBadge("Cached")}<span class="dashboard-cache-age muted">${escapeHtml(formatCacheAge(cachedAt))}</span>`;
  }

  if (status === "Live" && liveUpdatedAt) {
    return `${renderStatusBadge("Live")}<span class="dashboard-cache-age muted">${escapeHtml(formatCacheAge(liveUpdatedAt))}</span>`;
  }

  if (status === "Loading") {
    return renderStatusBadge("Loading");
  }

  if (status === "Error") {
    return renderStatusBadge("Error");
  }

  return renderStatusBadge("Not Loaded");
};

export {
  escapeHtml,
  formatCacheAge,
  formatTimestamp,
  renderCacheStatus,
  renderStatusBadge,
};
