const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderPipeSeparatedHtml = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  return text
    .split(/\s*\|\s*/)
    .map((part) => escapeHtml(part))
    .filter(Boolean)
    .join("<br>");
};

const formatPipeSeparatedDisplay = (value) => {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  if (!text.includes("|")) {
    return escapeHtml(text);
  }

  return renderPipeSeparatedHtml(text);
};

const joinPipeSeparatedCsv = (values) =>
  values
    .map((value) => String(value ?? ""))
    .filter((value) => value !== "")
    .join(" | ");

export { escapeHtml, formatPipeSeparatedDisplay, joinPipeSeparatedCsv, renderPipeSeparatedHtml };
