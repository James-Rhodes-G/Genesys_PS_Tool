const escapeCsvValue = (value) => {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const collectColumnKeys = (rows, preferredColumns = []) => {
  if (preferredColumns.length > 0) {
    return [...preferredColumns];
  }
  const keys = new Set();
  for (const row of rows) {
    Object.keys(row || {}).forEach((key) => keys.add(key));
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
};

const buildCsvFromRows = (rows, { preferredColumns = [], columnHeaders = {} } = {}) => {
  const flatRows = Array.isArray(rows) ? rows : [];

  const columns = collectColumnKeys(flatRows, preferredColumns);
  const lines = [columns.map((key) => escapeCsvValue(columnHeaders[key] || key)).join(",")];

  for (const row of flatRows) {
    lines.push(columns.map((key) => escapeCsvValue(row[key])).join(","));
  }

  return lines.join("\n");
};

export { buildCsvFromRows, escapeCsvValue, collectColumnKeys };
