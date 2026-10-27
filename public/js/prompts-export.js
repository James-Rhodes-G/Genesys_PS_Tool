import { escapeCsvValue, escapeHtml, joinPipeSeparatedCsv } from "./export-format.js";
import { downloadPromptExportPackage } from "./genesys-client.js";

const sanitizeRecordingFilenamePart = (value) =>
  String(value == null ? "" : value)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "prompt";

/** Backup naming for the recordings-only ZIP: `{promptName}_{resourceId}.wav`. */
const buildRecordingFilename = (promptName, resourceId) =>
  `${sanitizeRecordingFilenamePart(promptName)}_${sanitizeRecordingFilenamePart(resourceId)}.wav`;

const getPromptResources = (prompt) => (Array.isArray(prompt?.resources) ? prompt.resources : []);

/** Genesys bulk-import locale for CSV headers (audio_en-us, tts_en-us, ...). */
const getResourceLanguageCode = (resource) => {
  const raw = String(resource?.language || resource?.id || "").trim().toLowerCase();
  if (!raw) {
    return "unknown";
  }

  return raw.replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "") || "unknown";
};

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

const collectLanguageCodes = (rows) => {
  const languageCodes = new Set();

  rows.forEach((prompt) => {
    getPromptResources(prompt).forEach((resource) => {
      languageCodes.add(getResourceLanguageCode(resource));
    });
  });

  return [...languageCodes].sort((left, right) => left.localeCompare(right));
};

/**
 * Genesys bulk prompt import CSV: one row per user prompt, tts_/audio_/text_ columns per language.
 * @see https://help.genesys.cloud/articles/format-guidelines-csv-file-bulk-prompt-import/
 */
const buildGenesysBulkImportCsv = (rows) => {
  const languageCodes = collectLanguageCodes(rows);
  const headers = [
    "Name",
    "Type",
    "Description",
    ...languageCodes.flatMap((code) => [`tts_${code}`, `audio_${code}`, `text_${code}`]),
  ];

  const lines = [headers.map(escapeCsvValue).join(",")];

  rows.forEach((prompt) => {
    const resourceByLanguage = new Map();
    getPromptResources(prompt).forEach((resource) => {
      resourceByLanguage.set(getResourceLanguageCode(resource), resource);
    });

    const values = [prompt?.name || "", "user", prompt?.description || ""];

    languageCodes.forEach((code) => {
      const resource = resourceByLanguage.get(code);
      const audioFilename =
        resource?.mediaUri && prompt?.name
          ? buildGenesysImportAudioFilename(prompt.name, resource)
          : "";

      values.push(resource?.ttsString || "", audioFilename, resource?.text || "");
    });

    lines.push(values.map(escapeCsvValue).join(","));
  });

  return {
    csvText: lines.join("\n"),
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

const downloadPromptPackage = async ({ credentials, rows, mode, zipBasename }) => {
  const forImport = mode === "import-package";
  const recordings = collectPromptRecordings(rows, { forImport });
  const importCsv = forImport ? buildGenesysBulkImportCsv(rows) : null;

  const { blob, failureCount } = await downloadPromptExportPackage({
    ...credentials,
    mode,
    recordings,
    importCsvText: importCsv?.csvText,
    importCsvFilename: importCsv?.csvFilename,
  });

  triggerBlobDownload(blob, `${zipBasename}.zip`);

  return {
    recordingCount: recordings.length,
    promptCount: rows.length,
    failedCount: failureCount,
  };
};

const downloadPromptRecordingsZip = (options) =>
  downloadPromptPackage({ ...options, mode: "recordings-only" });

const downloadPromptImportPackage = (options) =>
  downloadPromptPackage({ ...options, mode: "import-package" });

/** Full prompt rows for an export, including rows offloaded to the session DB. */
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
  promptMediaUriToCsv,
  renderPromptMediaUriCell,
  resolvePromptExportRows,
};
