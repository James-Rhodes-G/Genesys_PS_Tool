import JSZip from "jszip";
import { buildCsvFromRows } from "./rows-to-csv.js";

const sanitizeExportFilenamePart = (value) =>
  String(value || "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "export";

const buildDateStamp = (date = new Date()) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

const buildExportZipFilename = (orgName, artifactLabel, date = new Date()) => {
  const orgPart = sanitizeExportFilenamePart(orgName);
  const artifactPart = sanitizeExportFilenamePart(artifactLabel);
  return `${orgPart}_${artifactPart}_${buildDateStamp(date)}.zip`;
};

const buildCatalogArtifactFilename = (orgName, exportId, date = new Date()) => {
  const orgPart = sanitizeExportFilenamePart(orgName);
  const exportPart = sanitizeExportFilenamePart(exportId);
  return `${orgPart}_${exportPart}_${buildDateStamp(date)}.csv`;
};

const buildCatalogExportZip = async ({ orgName, artifacts = [], zipLabel = "documentation", date = new Date() }) => {
  const zip = new JSZip();
  let included = 0;

  for (const artifact of artifacts) {
    const rows = artifact.rows || [];
    if (!rows.length) {
      continue;
    }
    const filename = artifact.filename || buildCatalogArtifactFilename(orgName, artifact.exportId, date);
    const csv = buildCsvFromRows(rows, { preferredColumns: artifact.preferredColumns || [] });
    zip.file(filename, csv);
    included += 1;
  }

  if (included === 0) {
    return { buffer: null, filename: "", included: 0, artifacts: [] };
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const filename = buildExportZipFilename(orgName, zipLabel, date);
  return { buffer, filename, included, artifacts };
};

export {
  buildCatalogExportZip,
  buildExportZipFilename,
  buildCatalogArtifactFilename,
  sanitizeExportFilenamePart,
  buildDateStamp,
};
