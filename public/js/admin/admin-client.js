const adminFetch = async (path, options = {}) => {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
};

const fetchDashboardSummary = () => adminFetch("/api/admin/dashboard/summary");
const fetchPresence = (range = "24h") => adminFetch(`/api/admin/dashboard/presence?range=${range}`);
const fetchMockApiTraffic = (range = "24h") => adminFetch(`/api/admin/dashboard/mock-api-traffic?range=${range}`);
const fetchStorage = (range = "7d") => adminFetch(`/api/admin/dashboard/storage?range=${range}`);
const fetchPlatform = (range = "24h") => adminFetch(`/api/admin/dashboard/platform?range=${range}`);
const fetchCoreApi = (range = "24h", { limit = 25, offset = 0 } = {}) => {
  const params = new URLSearchParams({ range, limit: String(limit), offset: String(offset) });
  return adminFetch(`/api/admin/dashboard/core-api?${params}`);
};
const fetchConnectedUsers = () => adminFetch("/api/admin/dashboard/connected-users");
const fetchAdminEvents = (params = {}) => {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
  const query = new URLSearchParams(filtered).toString();
  return adminFetch(`/api/admin/events${query ? `?${query}` : ""}`);
};
const fetchDangerousActions = () => adminFetch("/api/admin/dangerous-actions");
const fetchLaunchFunnel = (range = "24h") => adminFetch(`/api/admin/launch-funnel?range=${range}`);
const fetchSessions = () => adminFetch("/api/admin/sessions");
const fetchUsage = (range = "7d") => adminFetch(`/api/admin/usage?range=${range}`);
const fetchCompliance = () => adminFetch("/api/admin/compliance");
const fetchMockApiEndpoints = () => adminFetch("/api/admin/mock-api/endpoints");
const fetchJobs = () => adminFetch("/api/admin/jobs");
const fetchBackups = () => adminFetch("/api/admin/backups");
const fetchMaintenance = () => adminFetch("/api/admin/maintenance");
const setMaintenance = (mode) => adminFetch("/api/admin/maintenance", { method: "POST", body: JSON.stringify({ mode }) });
const revokeSession = (sessionId) => adminFetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}/revoke`, { method: "POST" });
const revokeVault = (linkId) => adminFetch(`/api/admin/vault/${encodeURIComponent(linkId)}/revoke`, { method: "POST" });
const pauseEndpoint = (id) => adminFetch(`/api/admin/mock-api/endpoints/${encodeURIComponent(id)}/pause`, { method: "POST" });
const activateEndpoint = (id) => adminFetch(`/api/admin/mock-api/endpoints/${encodeURIComponent(id)}/activate`, { method: "POST" });
const deleteEndpoint = (id) => adminFetch(`/api/admin/mock-api/endpoints/${encodeURIComponent(id)}`, { method: "DELETE" });
const postActivity = (payload) => adminFetch("/api/admin/activity", { method: "POST", body: JSON.stringify(payload) });
const fetchActivity = () => adminFetch("/api/admin/activity");
const runBackup = () => adminFetch("/api/admin/backups/run", { method: "POST" });
const runSnapshots = () => adminFetch("/api/admin/snapshots/run", { method: "POST", body: JSON.stringify({ type: "all" }) });

export {
  adminFetch,
  fetchDashboardSummary,
  fetchPresence,
  fetchMockApiTraffic,
  fetchStorage,
  fetchPlatform,
  fetchCoreApi,
  fetchConnectedUsers,
  fetchAdminEvents,
  fetchDangerousActions,
  fetchLaunchFunnel,
  fetchSessions,
  fetchUsage,
  fetchCompliance,
  fetchMockApiEndpoints,
  fetchJobs,
  fetchBackups,
  fetchMaintenance,
  setMaintenance,
  revokeSession,
  revokeVault,
  pauseEndpoint,
  activateEndpoint,
  deleteEndpoint,
  postActivity,
  fetchActivity,
  runBackup,
  runSnapshots,
};
