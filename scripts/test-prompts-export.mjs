import assert from "node:assert/strict";

process.env.PROMPT_EXPORT_SKIP_DNS = "1";
import JSZip from "jszip";
import {
  buildGenesysBulkImportCsv,
  buildGenesysImportAudioFilename,
  buildRecordingFilename,
  collectPromptRecordings,
  promptMediaUriToCsv,
  renderPromptMediaUriCell,
} from "../public/js/prompts-export.js";
import {
  buildPromptExportZip,
  isGenesysHost,
  parseRecordingUri,
} from "../src/lib/prompts-export-package.js";

const prompts = [
  {
    id: "p1",
    name: "Welcome",
    description: "Greeting, main line",
    resources: [
      { id: "en-us", language: "en-US", ttsString: "Hello", text: "Hello there", mediaUri: "https://media.example.com/a.wav" },
      { id: "fr-ca", language: "fr-CA", ttsString: "Bonjour", text: "Bonjour", mediaUri: "" },
    ],
  },
  {
    id: "p2",
    name: "Goodbye",
    description: "",
    resources: [{ id: "en-us", language: "en-us", ttsString: "Bye", text: "", mediaUri: "https://media.example.com/b.wav" }],
  },
];

// Genesys import naming: prompt_type_PromptName_LanguageCode.wav
assert.equal(buildGenesysImportAudioFilename("Welcome", prompts[0].resources[0]), "prompt_user_Welcome_en-us.wav");
assert.equal(buildRecordingFilename("My Prompt", "en-us"), "My_Prompt_en-us.wav");

// Import CSV: hyphenated language codes, audio_* matches the WAV name, no audio cell without mediaUri
{
  const { csvText } = buildGenesysBulkImportCsv(prompts);
  const [header, welcome, goodbye] = csvText.split("\n");
  assert.equal(header, "Name,Type,Description,tts_en-us,audio_en-us,text_en-us,tts_fr-ca,audio_fr-ca,text_fr-ca");
  assert.equal(
    welcome,
    'Welcome,user,"Greeting, main line",Hello,prompt_user_Welcome_en-us.wav,Hello there,Bonjour,,Bonjour'
  );
  assert.equal(goodbye, "Goodbye,user,,Bye,prompt_user_Goodbye_en-us.wav,,,,");
}

// Recording lists: import vs backup naming, resources without mediaUri skipped
{
  const forImport = collectPromptRecordings(prompts, { forImport: true });
  assert.deepEqual(
    forImport.map((entry) => entry.filename),
    ["prompt_user_Welcome_en-us.wav", "prompt_user_Goodbye_en-us.wav"]
  );
  const backup = collectPromptRecordings(prompts);
  assert.deepEqual(
    backup.map((entry) => entry.filename),
    ["Welcome_en-us.wav", "Goodbye_en-us.wav"]
  );
}

// Table cells
assert.equal(
  renderPromptMediaUriCell(prompts[0]),
  '<a href="https://media.example.com/a.wav" target="_blank" rel="noreferrer noopener">Listen en-us</a>'
);
assert.equal(promptMediaUriToCsv(prompts[0]), "https://media.example.com/a.wav");

// Server-side URL rules
assert.ok(parseRecordingUri("https://media.example.com/a.wav"));
for (const blocked of [
  "http://media.example.com/a.wav",
  "https://127.0.0.1/a.wav",
  "https://[::1]/a.wav",
  "https://localhost/a.wav",
  "https://intranet/a.wav",
  "not a url",
]) {
  assert.equal(parseRecordingUri(blocked), null, `expected ${blocked} to be rejected`);
}
assert.ok(isGenesysHost("api.mypurecloud.com", "mypurecloud.com"));
assert.ok(!isGenesysHost("mypurecloud.com.evil.example", "mypurecloud.com"));
assert.ok(!isGenesysHost("media.example.com", ""));

// ZIP builder: flat names, bearer only for Genesys hosts, failures reported
{
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ host: new URL(url).hostname, auth: options?.headers?.Authorization });
    if (String(url).includes("missing")) {
      return { ok: false, status: 404 };
    }
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode("RIFF").buffer };
  };

  try {
    const { zipBuffer, successCount, failures } = await buildPromptExportZip({
      mode: "import-package",
      importCsvText: "Name,Type\nWelcome,user",
      importCsvFilename: "../prompts_bulk_import.csv",
      token: "secret",
      genesysDomain: "mypurecloud.com",
      recordings: [
        { filename: "prompt_user_A_en-us.wav", mediaUri: "https://api.mypurecloud.com/a.wav" },
        { filename: "../prompt_user_B_en-us.wav", mediaUri: "https://s3.example.com/b.wav" },
        { filename: "prompt_user_C_en-us.wav", mediaUri: "https://s3.example.com/missing.wav" },
        { filename: "prompt_user_D_en-us.wav", mediaUri: "http://insecure.example.com/d.wav" },
      ],
    });

    assert.equal(successCount, 2);
    assert.deepEqual(failures.map((failure) => failure.filename).sort(), [
      "prompt_user_C_en-us.wav",
      "prompt_user_D_en-us.wav",
    ]);
    assert.equal(calls.find((call) => call.host === "api.mypurecloud.com").auth, "Bearer secret");
    assert.equal(calls.filter((call) => call.host === "s3.example.com").every((call) => !call.auth), true);
    assert.ok(!calls.some((call) => call.host === "insecure.example.com"));

    const names = Object.keys((await JSZip.loadAsync(zipBuffer)).files).sort();
    assert.deepEqual(names, [".._prompt_user_B_en-us.wav", ".._prompts_bulk_import.csv", "prompt_user_A_en-us.wav"]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  await assert.rejects(() => buildPromptExportZip({ mode: "recordings-only", recordings: [] }), /No prompt recordings/);
}

console.log("prompts export tests passed");
