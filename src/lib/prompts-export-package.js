import JSZip from "jszip";

const fetchRecordingBlob = async ({ mediaUri, token }) => {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(mediaUri, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.arrayBuffer();
};

const buildPromptExportZip = async ({ mode, recordings = [], importCsvText, importCsvFilename, token }) => {
  const zip = new JSZip();
  const failures = [];

  if (mode === "import-package" && importCsvText) {
    zip.file(importCsvFilename || "prompts_bulk_import.csv", importCsvText);
  }

  await Promise.all(
    recordings.map(async (entry) => {
      const filename = String(entry?.filename || "").trim();
      const mediaUri = String(entry?.mediaUri || "").trim();

      if (!filename || !mediaUri) {
        return;
      }

      try {
        const buffer = await fetchRecordingBlob({ mediaUri, token });
        zip.file(filename, buffer);
      } catch (error) {
        failures.push({
          filename,
          error: error?.message || "Download failed",
        });
      }
    })
  );

  if (mode === "import-package" && !importCsvText && recordings.length === 0) {
    throw new Error("No import CSV or recordings to export.");
  }

  if (mode === "recordings-only" && recordings.length === 0) {
    throw new Error("No prompt recordings to export.");
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  return {
    zipBuffer,
    successCount: recordings.length - failures.length,
    failures,
  };
};

export { buildPromptExportZip };
