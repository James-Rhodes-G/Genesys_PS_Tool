const isManualAuthAllowed = () => process.env.PS_TOOL_ALLOW_MANUAL_AUTH === "1";

const isPasswordExportAllowed = () => process.env.PS_TOOL_ALLOW_PASSWORD_EXPORT === "1";

const isSessionDbBackupIncluded = () => process.env.BACKUP_INCLUDE_SESSION_DB === "1";

const getSecurityPolicy = () => ({
  manualAuthAllowed: isManualAuthAllowed(),
  passwordExportAllowed: isPasswordExportAllowed(),
  backupIncludesSessionDb: isSessionDbBackupIncluded(),
  exportRetentionMs: Number(process.env.SESSION_EXPORT_RETENTION_MS || 24 * 60 * 60 * 1000),
});

export {
  getSecurityPolicy,
  isManualAuthAllowed,
  isPasswordExportAllowed,
  isSessionDbBackupIncluded,
};
