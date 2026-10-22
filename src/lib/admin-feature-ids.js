/** PS Tool Admin surfaces that require local operator login (not Genesys vault alone). */
const GATED_ADMIN_FEATURE_IDS = [
  "genesys-admin-operations",
  "genesys-admin-endpoint-registry",
  "genesys-admin-audit-log",
  "genesys-admin-activity",
  "genesys-admin-dangerous",
  "genesys-admin-server-health",
  "genesys-admin-launch-monitor",
  "genesys-admin-sessions",
  "genesys-admin-usage",
  "genesys-admin-storage",
];

const isGatedAdminFeatureId = (featureId) =>
  GATED_ADMIN_FEATURE_IDS.includes(String(featureId || "").trim());

export { GATED_ADMIN_FEATURE_IDS, isGatedAdminFeatureId };
