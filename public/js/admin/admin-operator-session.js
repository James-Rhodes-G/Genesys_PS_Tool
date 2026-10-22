let cachedSession = null;
let sessionPromise = null;

const fetchAdminSession = async ({ force = false } = {}) => {
  if (!force && cachedSession) {
    return cachedSession;
  }

  if (!force && sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = fetch("/api/admin/session", { credentials: "same-origin" })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      cachedSession = {
        authenticated: Boolean(payload.authenticated),
        username: payload.username || "",
      };
      return cachedSession;
    })
    .catch(() => {
      cachedSession = { authenticated: false, username: "" };
      return cachedSession;
    })
    .finally(() => {
      sessionPromise = null;
    });

  return sessionPromise;
};

const loginAdmin = async ({ username, password }) => {
  const response = await fetch("/api/admin/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Login failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  cachedSession = {
    authenticated: true,
    username: payload.username || username,
  };
  return cachedSession;
};

const logoutAdmin = async () => {
  await fetch("/api/admin/logout", {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => {});
  cachedSession = { authenticated: false, username: "" };
};

const isAdminAuthenticated = () => Boolean(cachedSession?.authenticated);

const clearAdminSessionCache = () => {
  cachedSession = null;
};

export {
  clearAdminSessionCache,
  fetchAdminSession,
  isAdminAuthenticated,
  loginAdmin,
  logoutAdmin,
};
