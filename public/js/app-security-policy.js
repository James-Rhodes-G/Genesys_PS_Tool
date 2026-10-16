let cachedPolicy = null;

const loadAppSecurityPolicy = async () => {
  if (cachedPolicy) {
    return cachedPolicy;
  }

  const response = await fetch("/api/app/security-policy", { credentials: "include" });
  if (!response.ok) {
    cachedPolicy = {
      manualAuthAllowed: false,
      passwordExportAllowed: false,
      backupIncludesSessionDb: false,
    };
    return cachedPolicy;
  }

  cachedPolicy = await response.json();
  return cachedPolicy;
};

const isManualAuthAllowed = () => Boolean(cachedPolicy?.manualAuthAllowed);

const isPasswordExportAllowed = () => Boolean(cachedPolicy?.passwordExportAllowed);

export { isManualAuthAllowed, isPasswordExportAllowed, loadAppSecurityPolicy };
