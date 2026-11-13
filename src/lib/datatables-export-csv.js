const METADATA_COLUMNS = new Set(["tableId", "tableName"]);

const sanitizeExportFilenamePart = (value) =>
  String(value || "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "data_table";

const buildDateStamp = (date = new Date()) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

const buildDataTableExportFilename = (orgName, tableName, date = new Date()) => {
  const orgPart = sanitizeExportFilenamePart(orgName || "organization");
  const tablePart = sanitizeExportFilenamePart(tableName);
  return `${orgPart}_${tablePart}_${buildDateStamp(date)}.csv`;
};

const buildDataTablesZipFilename = (orgName, date = new Date()) => {
  const orgPart = sanitizeExportFilenamePart(orgName || "organization");
  return `${orgPart}_datatables_${buildDateStamp(date)}.zip`;
};

const escapeCsvValue = (value) => {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const unwrapDataTableCell = (value) => {
  if (value == null) {
    return "";
  }
  if (typeof value !== "object") {
    return value;
  }
  if (Object.prototype.hasOwnProperty.call(value, "value") && value.value != null && value.value !== "") {
    return value.value;
  }
  if (Object.prototype.hasOwnProperty.call(value, "display")) {
    return value.display ?? "";
  }
  if (Array.isArray(value)) {
    return value.map(unwrapDataTableCell).filter((entry) => entry !== "").join(" | ");
  }
  return value;
};

const formatDataTableCell = (value) => {
  const unwrapped = unwrapDataTableCell(value);
  if (unwrapped == null) {
    return "";
  }
  if (typeof unwrapped === "object") {
    return JSON.stringify(unwrapped);
  }
  return String(unwrapped);
};

const stripTableMetadata = (row) => {
  if (!row || typeof row !== "object") {
    return {};
  }
  return Object.fromEntries(Object.entries(row).filter(([key]) => !METADATA_COLUMNS.has(key)));
};

const collectDataTableColumns = (rows) => {
  const keys = new Set();
  rows.forEach((row) => {
    Object.keys(stripTableMetadata(row)).forEach((key) => keys.add(key));
  });
  const preferred = ["key"];
  const ordered = preferred.filter((key) => keys.has(key));
  const remainder = Array.from(keys)
    .filter((key) => !preferred.includes(key))
    .sort();
  return [...ordered, ...remainder];
};

const buildDataTableCsv = (rows) => {
  const dataRows = (rows || []).map(stripTableMetadata);
  const columns = collectDataTableColumns(dataRows);
  const lines = [columns.map((column) => escapeCsvValue(column)).join(",")];
  dataRows.forEach((row) => {
    lines.push(columns.map((column) => escapeCsvValue(formatDataTableCell(row[column]))).join(","));
  });
  return lines.join("\n");
};

export {
  buildDataTableCsv,
  buildDataTableExportFilename,
  buildDataTablesZipFilename,
  formatDataTableCell,
  stripTableMetadata,
};
