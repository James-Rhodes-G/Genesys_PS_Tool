const LAUNCH_FEATURES = new Set([
  "genesys-dashboard",
  "genesys-users",
  "genesys-user-roles",
  "genesys-user-skills",
  "genesys-phones",
  "genesys-roles",
  "genesys-queues",
  "genesys-queue-members",
  "genesys-skills",
  "genesys-groups",
  "genesys-group-members",
  "genesys-prompts",
  "genesys-datatable-export",
  "genesys-inbound-call-spoof",
  "genesys-report-call-spoof",
  "genesys-report-conversation",
  "genesys-report-attributes",
  "genesys-report-flow",
  "genesys-report-interaction",
  "genesys-report-intent-health",
  "genesys-report-utterances",
  "genesys-bulk-skill-assignment",
  "genesys-bulk-role-assign",
  "genesys-bulk-auto-answer",
  "genesys-bulk-password-reset",
  "genesys-bulk-logoff",
  "genesys-bulk-disconnect",
  "genesys-bulk-priority-update",
  "genesys-bulk-phone-build",
  "genesys-bulk-phone-move",
  "genesys-bulk-phone-remove",
  "genesys-bulk-phone-site-migrate",
  "genesys-load-schedules",
  "genesys-mock-api",
  "genesys-audit-log-viewer",
  "genesys-user-notifications",
  "genesys-queue-notifications",
  "genesys-outbound-notifications",
  "genesys-notification-message-parser",
  "genesys-create-master-admin",
]);

const LAUNCH_PARAM_KEYS = new Set(["conversationId"]);

const isLaunchFeature = (feature) => LAUNCH_FEATURES.has(String(feature || "").trim());

const sanitizeLaunchParams = (params) => {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return {};
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(params)) {
    if (!LAUNCH_PARAM_KEYS.has(key)) {
      continue;
    }
    const normalized = String(value || "").trim().slice(0, 256);
    if (normalized) {
      sanitized[key] = normalized;
    }
  }

  return sanitized;
};

export { isLaunchFeature, LAUNCH_FEATURES, sanitizeLaunchParams };
