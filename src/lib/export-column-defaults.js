/** exportKey values match `exportMeta.exportType` in the interactive UI. */
const INTERACTIVE_EXPORT_MANIFEST = [
  { exportKey: "users", label: "Users" },
  { exportKey: "user_role_mappings", label: "User Roles" },
  { exportKey: "user_skill_mappings", label: "User Skills" },
  { exportKey: "phones", label: "Phones" },
  { exportKey: "roles", label: "Roles" },
  { exportKey: "queues", label: "Queues" },
  { exportKey: "queue_members", label: "Queue Members" },
  { exportKey: "skills", label: "Skills" },
  { exportKey: "groups", label: "Groups" },
  { exportKey: "group_members", label: "Group Members" },
  { exportKey: "prompts", label: "Prompts" },
  { exportKey: "divisions", label: "Divisions" },
  { exportKey: "wrapup_codes", label: "Wrap-Up Codes" },
  { exportKey: "sites", label: "Sites" },
  { exportKey: "locations", label: "Locations" },
  { exportKey: "teams", label: "Teams" },
  { exportKey: "campaigns", label: "Campaigns" },
];

const manifestByKey = new Map(INTERACTIVE_EXPORT_MANIFEST.map((entry) => [entry.exportKey, entry]));

const isKnownInteractiveExportKey = (exportKey) => manifestByKey.has(String(exportKey || "").trim());

const normalizeColumnKeys = (input) => {
  const list = Array.isArray(input)
    ? input
    : String(input || "")
        .split(/[\n,]+/)
        .map((line) => line.trim())
        .filter(Boolean);

  const seen = new Set();
  const normalized = [];
  for (const key of list) {
    const trimmed = String(key).trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    if (trimmed.length > 256) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized.slice(0, 200);
};

export {
  INTERACTIVE_EXPORT_MANIFEST,
  isKnownInteractiveExportKey,
  manifestByKey,
  normalizeColumnKeys,
};