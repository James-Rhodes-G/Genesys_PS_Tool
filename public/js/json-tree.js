const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const valueClass = (value) => {
  if (value === null) {
    return "json-null";
  }

  switch (typeof value) {
    case "string":
      return "json-string";
    case "number":
      return "json-number";
    case "boolean":
      return "json-boolean";
    default:
      return "json-unknown";
  }
};

const formatPrimitive = (value) => {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return `"${escapeHtml(value)}"`;
  }

  return escapeHtml(String(value));
};

const renderPrimitiveLine = (key, value) => {
  const line = document.createElement("div");
  line.className = "json-line json-leaf";

  if (key !== null && key !== undefined) {
    line.innerHTML =
      `<span class="json-key">${escapeHtml(JSON.stringify(String(key)))}</span>` +
      '<span class="json-colon">: </span>' +
      `<span class="${valueClass(value)}">${formatPrimitive(value)}</span>`;
  } else {
    line.innerHTML = `<span class="${valueClass(value)}">${formatPrimitive(value)}</span>`;
  }

  return line;
};

const renderCollection = (key, value, options) => {
  const isArray = Array.isArray(value);
  const entries = isArray
    ? value.map((entry, index) => [index, entry])
    : Object.keys(value).map((objectKey) => [objectKey, value[objectKey]]);

  const details = document.createElement("details");
  details.className = "json-node";
  if (options?.expand !== false) {
    details.open = true;
  }

  const summary = document.createElement("summary");
  summary.className = "json-summary";

  const label = isArray ? `Array(${entries.length})` : `Object(${entries.length})`;

  if (key !== null && key !== undefined) {
    summary.innerHTML =
      `<span class="json-key">${escapeHtml(JSON.stringify(String(key)))}</span>` +
      '<span class="json-colon">: </span>' +
      `<span class="json-meta">${escapeHtml(label)}</span>`;
  } else {
    summary.innerHTML = `<span class="json-meta">${escapeHtml(label)}</span>`;
  }

  details.appendChild(summary);

  const children = document.createElement("div");
  children.className = "json-children";

  entries.forEach(([entryKey, entryValue]) => {
    children.appendChild(renderNode(entryKey, entryValue, options));
  });

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "json-line json-empty";
    empty.textContent = isArray ? "[]" : "{}";
    children.appendChild(empty);
  }

  details.appendChild(children);
  return details;
};

const renderNode = (key, value, options) => {
  if (value === null || typeof value !== "object") {
    return renderPrimitiveLine(key, value);
  }

  return renderCollection(key, value, options);
};

const renderJsonTree = (value, options = {}) => {
  const root = document.createElement("div");
  root.className = "json-tree";

  if (value === null || typeof value !== "object") {
    root.appendChild(renderPrimitiveLine(null, value));
    return root;
  }

  root.appendChild(renderCollection(null, value, options));
  return root;
};

const setAllJsonTreeExpanded = (container, expanded) => {
  if (!container) {
    return;
  }

  container.querySelectorAll("details.json-node").forEach((node) => {
    node.open = expanded;
  });
};

export { renderJsonTree, setAllJsonTreeExpanded };
