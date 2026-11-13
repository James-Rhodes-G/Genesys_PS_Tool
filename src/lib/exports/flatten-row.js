const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);

const getByPath = (obj, path) => {
  if (!path) {
    return undefined;
  }
  const parts = String(path).split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null) {
      return undefined;
    }
    current = current[part];
  }
  return current;
};

const formatLeafValue = (value) => {
  if (value == null) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value
        .map((entry) => formatLeafValue(entry))
        .filter((entry) => entry !== "")
        .join(" | ");
    }
    if (value.id && value.name) {
      return value.name;
    }
    if (value.id) {
      return value.id;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value;
};

const flattenRow = (entity, { preferredColumns = [], maxDepth = 3 } = {}) => {
  if (!entity || typeof entity !== "object") {
    return {};
  }

  const row = {};

  if (preferredColumns.length > 0) {
    for (const column of preferredColumns) {
      row[column] = formatLeafValue(getByPath(entity, column));
    }
    return row;
  }

  const walk = (value, prefix, depth) => {
    if (depth > maxDepth || value == null) {
      if (prefix) {
        row[prefix] = formatLeafValue(value);
      }
      return;
    }
    if (!isPlainObject(value)) {
      if (prefix) {
        row[prefix] = formatLeafValue(value);
      }
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      if (isPlainObject(child) && depth < maxDepth) {
        walk(child, nextKey, depth + 1);
      } else {
        row[nextKey] = formatLeafValue(child);
      }
    }
  };

  walk(entity, "", 0);
  return row;
};

const flattenEntities = (entities, options = {}) =>
  (Array.isArray(entities) ? entities : []).map((entity) => flattenRow(entity, options));

export { flattenRow, flattenEntities, getByPath, formatLeafValue };
