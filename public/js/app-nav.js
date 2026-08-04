const NAV_COLLAPSED_KEY = "ps-tool-nav-collapsed";
const NAV_WIDTH_EXPANDED = "280px";
const NAV_WIDTH_COLLAPSED = "56px";

const setNavCollapsed = (nav, collapsed) => {
  nav.dataset.collapsed = collapsed ? "true" : "false";
  document.documentElement.style.setProperty(
    "--app-nav-width",
    collapsed ? NAV_WIDTH_COLLAPSED : NAV_WIDTH_EXPANDED
  );
  localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? "1" : "0");

  const toggle = nav.querySelector("#navigation-menu");
  if (toggle) {
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggle.setAttribute(
      "aria-label",
      collapsed ? "Open Navigation Menu" : "Close Menu"
    );
  }

  if (collapsed) {
    closeSubmenu(nav);
  }
};

const closeSubmenu = (nav) => {
  nav.dataset.submenuOpen = "false";
  nav.dataset.activeSubmenu = "";

  nav.querySelectorAll("[data-nav-group-toggle]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
    button.classList.remove("selected");
  });

  nav.querySelectorAll("[data-submenu-panel]").forEach((panel) => {
    panel.hidden = true;
    panel.classList.remove("is-active");
  });
};

const openSubmenu = (nav, groupId) => {
  closeSubmenu(nav);

  const toggle = nav.querySelector(`[data-nav-group="${groupId}"] [data-nav-group-toggle]`);
  const submenuPanel = nav.querySelector(`[data-submenu-panel="${groupId}"]`);

  if (!toggle || !submenuPanel) {
    return;
  }

  nav.dataset.submenuOpen = "true";
  nav.dataset.activeSubmenu = groupId;
  toggle.setAttribute("aria-expanded", "true");
  toggle.classList.add("selected");
  submenuPanel.hidden = false;
  submenuPanel.classList.add("is-active");
};

const initializeAppNav = () => {
  const nav = document.getElementById("app-global-nav");
  if (!nav) {
    return;
  }

  const savedCollapsed = localStorage.getItem(NAV_COLLAPSED_KEY) === "1";
  setNavCollapsed(nav, savedCollapsed);

  nav.querySelector("#navigation-menu")?.addEventListener("click", () => {
    setNavCollapsed(nav, nav.dataset.collapsed !== "true");
  });

  nav.querySelectorAll("[data-nav-group-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.closest("[data-nav-group]");
      const groupId = group?.dataset.navGroup;
      if (!groupId) {
        return;
      }

      if (nav.dataset.collapsed === "true") {
        setNavCollapsed(nav, false);
        openSubmenu(nav, groupId);
        return;
      }

      const isOpen =
        nav.dataset.submenuOpen === "true" &&
        nav.dataset.activeSubmenu === groupId;

      if (isOpen) {
        closeSubmenu(nav);
        return;
      }

      openSubmenu(nav, groupId);
    });
  });

  nav.querySelectorAll("[data-nav-submenu-return]").forEach((button) => {
    button.addEventListener("click", () => {
      closeSubmenu(nav);
    });
  });
};

export { initializeAppNav };
