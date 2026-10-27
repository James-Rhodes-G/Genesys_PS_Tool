import { escapeHtml, joinPipeSeparatedCsv } from "./export-format.js";
import { downloadPromptExportPackage } from "./genesys-client.js";

const escapeCsv = (value) => {
  const stringValue = String(value == null ? "" : value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const sanitizeRecordingFilenamePart = (value) =>
  String(value == null ? "" : value)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "prompt";

const buildRecordingFilename = (promptName, resourceId) =>
  `${sanitizeRecordingFilenamePart(promptName)}_${sanitizeRecordingFilenamePart(resourceId)}.wav`;

const getPromptResources = (prompt) => (Array.isArray(prompt?.resources) ? prompt.resources : []);

/** Genesys bulk-import locale for CSV headers (audio_en-us, tts_en-us, …). */
const getResourceLanguageCode = (resource) => {
  const raw = String(resource?.language || resource?.id || "").trim().toLowerCase();
  if (!raw) {
    return "unknown";
  }

  return raw.replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "") || "unknown";
};

const languageCodeToImportSuffix = (resource) => getResourceLanguageCode(resource);

const sanitizePromptNameForImportFile = (name) =>
  String(name ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_");

/**
 * Genesys Architect bulk import WAV naming:
 * prompt_type_PromptName_LanguageCode.wav
 * @see https://help.genesys.cloud/articles/prompt-naming-conventions-bulk-import/
 */
const buildGenesysImportAudioFilename = (promptName, resource, promptType = "user") => {
  const languageCode = getResourceLanguageCode(resource);
  const safePromptName = sanitizePromptNameForImportFile(promptName) || "prompt";
  return `prompt_${promptType}_${safePromptName}_${languageCode}.wav`;
};

const renderPromptMediaUriCell = (row) => {
  const links = getPromptResources(row)
    .filter((resource) => resource?.mediaUri && resource?.id)
    .map((resource) => {
      const href = escapeHtml(resource.mediaUri);
      const id = escapeHtml(resource.id);
      return `<a href="${href}" target="_blank" rel="noreferrer noopener">Listen ${id}</a>`;
    });

  return links.join("<br>");
};

const promptMediaUriToCsv = (row) =>
  joinPipeSeparatedCsv(
    getPromptResources(row)
      .map((resource) => resource?.mediaUri)
      .filter(Boolean)
  );

const collectLanguageSuffixes = (rows) => {
  const suffixes = new Set();

  rows.forEach((prompt) => {
    getPromptResources(prompt).forEach((resource) => {
      suffixes.add(languageCodeToImportSuffix(resource));
    });
  });

  return [...suffixes].sort((left, right) => left.localeCompare(right));
};

const buildGenesysBulkImportCsv = (rows) => {
  const suffixes = collectLanguageSuffixes(rows);
  const fixedHeaders = ["Name", "Type", "Description"];
  const languageHeaders = suffixes.flatMap((suffix) => [
    `tts_${suffix}`,
    `audio_${suffix}`,
    `text_${suffix}`,
  ]);
  const headers = [...fixedHeaders, ...languageHeaders];

  const lines = [headers.map(escapeCsv).join(",")];

  rows.forEach((prompt) => {
    const resourceBySuffix = new Map();
    getPromptResources(prompt).forEach((resource) => {
      resourceBySuffix.set(languageCodeToImportSuffix(resource), resource);
    });

    const values = [
      prompt?.name || "",
      "user",
      prompt?.description || "",
    ];

    suffixes.forEach((suffix) => {
      const resource = resourceBySuffix.get(suffix);
      const audioFilename =
        resource?.mediaUri && prompt?.name
          ? buildGenesysImportAudioFilename(prompt.name, resource)
          : "";

      values.push(resource?.ttsString || "", audioFilename, resource?.text || "");
    });

    lines.push(values.map(escapeCsv).join(","));
  });

  return {
    csvText: lines.join("\n"),
    headers,
    csvFilename: "prompts_bulk_import.csv",
  };
};

const collectPromptRecordings = (rows, { forImport = false } = {}) => {
  const recordings = [];

  rows.forEach((prompt) => {
    const promptName = prompt?.name || prompt?.id || "prompt";
    getPromptResources(prompt).forEach((resource) => {
      if (!resource?.mediaUri || !resource?.id) {
        return;
      }

      recordings.push({
        mediaUri: resource.mediaUri,
        filename: forImport
          ? buildGenesysImportAudioFilename(promptName, resource)
          : buildRecordingFilename(promptName, resource.id),
      });
    });
  });

  return recordings;
};

const triggerBlobDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const downloadPromptPackage = async ({
  credentials,
  rows,
  mode,
  zipBasename,
  onProgress,
}) => {
  const forImport = mode === "import-package";
  const recordings = collectPromptRecordings(rows, { forImport });
  const importCsv = forImport ? buildGenesysBulkImportCsv(rows) : null;

  onProgress?.({
    message: `Preparing ${mode === "import-package" ? "import package" : "recordings"} (${recordings.length} file(s))...`,
    current: 0,
    total: Math.max(recordings.length, 1),
  });

  const blob = await downloadPromptExportPackage({
    ...credentials,
    mode,
    recordings,
    importCsvText: importCsv?.csvText,
    importCsvFilename: importCsv?.csvFilename,
  });

  triggerBlobDownload(blob, `${zipBasename || "prompts_export"}.zip`);

  return {
    recordingCount: recordings.length,
    promptCount: rows.length,
    failedCount: 0,
  };
};

const downloadPromptRecordingsZip = (options) =>
  downloadPromptPackage({ ...options, mode: "recordings-only" });

const downloadPromptImportPackage = (options) =>
  downloadPromptPackage({ ...options, mode: "import-package" });

const resolvePromptExportRows = async ({ exportMeta, fetchAllExportRows }) => {
  let rows = exportMeta?.rows || [];
  if (exportMeta?.sessionStored && typeof fetchAllExportRows === "function") {
    try {
      const payload = await fetchAllExportRows({ exportId: exportMeta.resultId });
      rows = payload.rows || rows;
    } catch (error) {
      console.warn("Failed to load all session rows for prompts export:", error);
    }
  }

  return rows;
};

export {
  buildGenesysBulkImportCsv,
  buildGenesysImportAudioFilename,
  buildRecordingFilename,
  collectPromptRecordings,
  downloadPromptImportPackage,
  downloadPromptRecordingsZip,
  languageCodeToImportSuffix,
  promptMediaUriToCsv,
  renderPromptMediaUriCell,
  resolvePromptExportRows,
  sanitizeRecordingFilenamePart,
};
