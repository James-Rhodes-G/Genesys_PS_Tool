const getValuesForPath = (source, path) => {
  const segments = String(path || "").split(".");

  const visit = (current, index) => {
    if (index >= segments.length) {
      return [current];
    }

    const segment = segments[index];
    const isArraySegment = segment.endsWith("[]");
    const key = isArraySegment ? segment.slice(0, -2) : segment;
    const next = key ? current && current[key] : current;

    if (isArraySegment) {
      if (!Array.isArray(next)) {
        return [];
      }

      return next.flatMap((item) => visit(item, index + 1));
    }

    return visit(next, index + 1);
  };

  return visit(source, 0).filter((value) => value != null && value !== "");
};

const formatSortValue = (value) => {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value == null) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

const getRowSortValue = (row, columnKey, exportMeta) => {
  const column = exportMeta?.availableColumns?.find((entry) => entry.key === columnKey);

  if (column && typeof column.getValues === "function") {
    return column
      .getValues(row)
      .map(formatSortValue)
      .filter((value) => value !== "")
      .join(" | ");
  }

  if (column && typeof column.toCsv === "function") {
    return formatSortValue(column.toCsv(row));
  }

  return getValuesForPath(row, columnKey)
    .map(formatSortValue)
    .filter((value) => value !== "")
    .join(" | ");
};

export { getRowSortValue, getValuesForPath };
