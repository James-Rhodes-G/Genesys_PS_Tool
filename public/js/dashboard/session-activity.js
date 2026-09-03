const sessionActivities = [];

const recordSessionActivity = ({ action, affectedCount = 0, successCount = 0, failureCount = 0 }) => {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    action,
    affectedCount,
    successCount,
    failureCount,
  };
  sessionActivities.unshift(entry);

  fetch("/api/admin/activity", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      affectedCount,
      successCount,
      failureCount,
    }),
  }).catch(() => {});
};

const recordSessionActivityFromResults = (action, rows = []) => {
  const successCount = rows.filter((row) => String(row.status || "").toLowerCase() === "success").length;
  const failureCount = rows.filter((row) => {
    const status = String(row.status || "").toLowerCase();
    return status && status !== "success";
  }).length;

  recordSessionActivity({
    action,
    affectedCount: rows.length,
    successCount,
    failureCount,
  });
};

const getSessionActivities = () => sessionActivities.slice();

const clearSessionActivities = () => {
  sessionActivities.length = 0;
};

const ACTIVITY_EXPORT_TYPES = {
  bulk_role_assign: "Bulk Role Assignment",
  bulk_skill_assign: "Bulk Skill Assignment",
  bulk_auto_answer: "Bulk Auto Answer",
  bulk_password_reset: "Password Reset",
  bulk_logoff: "User Logoff",
  bulk_phone_build: "Phone Build",
  bulk_phone_move: "Phone Move",
  bulk_phone_remove: "Phone Removal",
  bulk_phone_site_migrate: "Phone Site Migration",
  bulk_disconnect_results: "Bulk Disconnect",
  bulk_priority_update: "Priority Update",
  load_schedules: "Load Schedules",
  master_admin_role: "Master Admin Creation",
  call_spoof: "Call Spoof",
};

export {
  ACTIVITY_EXPORT_TYPES,
  clearSessionActivities,
  getSessionActivities,
  recordSessionActivity,
  recordSessionActivityFromResults,
};
