import {
  fetchAdminSession,
  isAdminAuthenticated,
  loginAdmin,
  logoutAdmin,
} from "./admin-operator-session.js";

const syncAdminNavVisibility = ({ authenticated, username = "" } = {}) => {
  document.querySelectorAll("[data-admin-gated]").forEach((element) => {
    element.hidden = !authenticated;
    const button = element.querySelector("button");
    if (button) {
      button.disabled = !authenticated;
    }
  });

  const loginBtn = document.getElementById("ps-tool-admin-login");
  const logoutBtn = document.getElementById("ps-tool-admin-logout");
  const statusEl = document.getElementById("ps-tool-admin-login-status");

  if (loginBtn) {
    loginBtn.hidden = authenticated;
  }
  if (logoutBtn) {
    logoutBtn.hidden = !authenticated;
  }
  if (statusEl) {
    statusEl.textContent = authenticated
      ? `Signed in as operator: ${username}`
      : "Server tools require a local operator login.";
  }
};

const openAdminLoginModal = () => {
  const modal = document.getElementById("ps-tool-admin-login-modal");
  const errorEl = document.getElementById("ps-tool-admin-login-error");
  if (errorEl) {
    errorEl.textContent = "";
  }
  if (modal) {
    modal.open = true;
  }
};

const closeAdminLoginModal = () => {
  const modal = document.getElementById("ps-tool-admin-login-modal");
  if (modal) {
    modal.open = false;
  }
};

const bindAdminOperatorUi = ({ onAuthChange } = {}) => {
  const loginBtn = document.getElementById("ps-tool-admin-login");
  const logoutBtn = document.getElementById("ps-tool-admin-logout");
  const submitBtn = document.getElementById("ps-tool-admin-login-submit");
  const cancelBtn = document.getElementById("ps-tool-admin-login-cancel");
  const usernameInput = document.getElementById("ps-tool-admin-login-username");
  const passwordInput = document.getElementById("ps-tool-admin-login-password");
  const errorEl = document.getElementById("ps-tool-admin-login-error");

  const notify = async () => {
    const session = await fetchAdminSession({ force: true });
    syncAdminNavVisibility(session);
    if (typeof onAuthChange === "function") {
      onAuthChange(session);
    }
    return session;
  };

  loginBtn?.addEventListener("click", () => openAdminLoginModal());

  cancelBtn?.addEventListener("click", () => closeAdminLoginModal());

  logoutBtn?.addEventListener("click", async () => {
    await logoutAdmin();
    await notify();
  });

  submitBtn?.addEventListener("click", async () => {
    const username = usernameInput?.value?.trim() || "";
    const password = passwordInput?.value || "";
    if (!username || !password) {
      if (errorEl) {
        errorEl.textContent = "Enter username and password.";
      }
      return;
    }

    try {
      await loginAdmin({ username, password });
      if (passwordInput) {
        passwordInput.value = "";
      }
      closeAdminLoginModal();
      await notify();
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message || "Login failed.";
      }
    }
  });

  return {
    refresh: notify,
    requireAdmin: async () => {
      const session = await fetchAdminSession();
      if (session.authenticated) {
        return true;
      }
      openAdminLoginModal();
      return false;
    },
    isAuthenticated: isAdminAuthenticated,
  };
};

export { bindAdminOperatorUi, openAdminLoginModal, syncAdminNavVisibility };
