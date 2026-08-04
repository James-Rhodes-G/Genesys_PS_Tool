const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderRegionOptions = (regions) =>
  (regions || [])
    .map(
      (region) =>
        `<gux-option value="${escapeHtml(region.id)}">${escapeHtml(region.label || region.id)}</gux-option>`
    )
    .join("");

const renderRegionPicker = (regions) => `<div class="field-container region-picker__field">
          <label class="field-label" for="genesys-region-select">Region</label>
          <gux-dropdown id="genesys-region-select" class="genesys-region-select" placeholder="Select a region">
            <gux-listbox aria-label="Genesys regions">${renderRegionOptions(regions)}</gux-listbox>
          </gux-dropdown>
        </div>`;

const navSubmenuItem = (id, label) =>
  `<li class="menu-item-container sublink-title-container">
  <button type="button" class="nav-item nav-link sublink-title" id="${escapeHtml(id)}" disabled>${escapeHtml(label)}</button>
</li>`;

const navMainItem = ({ id, label, icon }) => `<li class="menu-item-container" data-nav-group="${escapeHtml(id)}">
  <button type="button" class="nav-item command-nav__group-toggle" data-nav-group-toggle aria-expanded="false">
    <span class="title-items">
      <gux-icon icon-name="${escapeHtml(icon)}" decorative="true" size="inherit"></gux-icon>
      <div class="link-title">${escapeHtml(label)}</div>
    </span>
    <span class="action-icons-hovers">
      <gux-icon icon-name="custom/chevron-right-small-regular" decorative="true" size="inherit"></gux-icon>
    </span>
  </button>
</li>`;

const navSubmenuPanel = ({ id, label, bodyHtml }) => `<div class="command-nav__submenu-panel" data-submenu-panel="${escapeHtml(id)}" hidden>
  <ul class="submenu-scroll-container">
    <li class="submenu-specifics">
      <div class="nav-item submenu-title">${escapeHtml(label)}</div>
      <div class="submenu-return-container">
        <button type="button" class="nav-item submenu-return" data-nav-submenu-return>
          <gux-icon icon-name="arrow-left" decorative="true" size="inherit"></gux-icon>
          <div>Return to main menu</div>
        </button>
      </div>
    </li>
    ${bodyHtml}
  </ul>
</div>`;

const navGroupDefinition = ({ id, label, icon, bodyHtml }) => ({
  mainItem: navMainItem({ id, label, icon }),
  submenuPanel: navSubmenuPanel({ id, label, bodyHtml }),
});

const renderAppSidebar = () => {
  const groups = [
    navGroupDefinition({
      id: "exports",
      label: "Exports",
      icon: "export",
      bodyHtml: `${navSubmenuItem("genesys-users", "Users")}
${navSubmenuItem("genesys-user-roles", "User Roles")}
${navSubmenuItem("genesys-user-skills", "User Skills")}
${navSubmenuItem("genesys-phones", "Phone")}
${navSubmenuItem("genesys-roles", "Roles")}
${navSubmenuItem("genesys-queues", "Queues")}
${navSubmenuItem("genesys-queue-members", "Queue Members")}
${navSubmenuItem("genesys-skills", "Skills")}
${navSubmenuItem("genesys-groups", "Groups")}
${navSubmenuItem("genesys-group-members", "Group Users")}
${navSubmenuItem("genesys-prompts", "Prompts")}
${navSubmenuItem("genesys-datatable-export", "Data Table Export")}
<li class="menu-item-container"><p id="exports-status" class="command-nav__status">Connect to an organization to enable exports.</p></li>`,
    }),
    navGroupDefinition({
      id: "inbound-call-spoof",
      label: "Inbound Call Spoof",
      icon: "phone",
      bodyHtml: `${navSubmenuItem("genesys-inbound-call-spoof", "Inbound Call Spoof")}
<li class="menu-item-container"><p id="inbound-call-spoof-status" class="command-nav__status">Connect to an organization to run inbound call spoof tests.</p></li>`,
    }),
    navGroupDefinition({
      id: "interaction-data",
      label: "Interaction Data",
      icon: "graph-line",
      bodyHtml: `<li class="menu-item-container command-nav__field">
  <gux-form-field-text-like label-position="above" clearable="true">
    <input slot="input" id="genesys-report-conversation-id" type="text" placeholder="Conversation ID" aria-label="Conversation ID" class="sidebar-input" />
    <label slot="label">Conversation ID</label>
  </gux-form-field-text-like>
</li>
${navSubmenuItem("genesys-report-conversation", "Conversation Data")}
${navSubmenuItem("genesys-report-attributes", "Attributes")}
${navSubmenuItem("genesys-report-flow", "Flow Execution")}
${navSubmenuItem("genesys-report-interaction", "Interaction Details")}
${navSubmenuItem("genesys-report-call-spoof", "Outbound Call Spoof")}
${navSubmenuItem("genesys-report-intent-health", "Intent Health")}
${navSubmenuItem("genesys-report-utterances", "Utterances")}
<li class="menu-item-container"><p id="reports-status" class="command-nav__status">Connect to an organization to run reports.</p></li>`,
    }),
    navGroupDefinition({
      id: "bulk-actions",
      label: "Bulk Actions",
      icon: "fa/users-regular",
      bodyHtml: `${navSubmenuItem("genesys-bulk-skill-assignment", "Bulk Skill Assign")}
${navSubmenuItem("genesys-bulk-role-assign", "Bulk Role Assign")}
${navSubmenuItem("genesys-bulk-auto-answer", "Bulk Auto Answer")}
${navSubmenuItem("genesys-bulk-password-reset", "Password Reset")}
${navSubmenuItem("genesys-bulk-logoff", "User Logoff")}
${navSubmenuItem("genesys-bulk-disconnect", "Bulk Disconnect")}
${navSubmenuItem("genesys-bulk-priority-update", "Priority Updater")}
${navSubmenuItem("genesys-bulk-phone-build", "Phone Build")}
${navSubmenuItem("genesys-bulk-phone-move", "Phone Mover")}
${navSubmenuItem("genesys-bulk-phone-remove", "Phone Remover")}
${navSubmenuItem("genesys-bulk-phone-site-migrate", "Phone Site Migrator")}
${navSubmenuItem("genesys-load-schedules", "Load Schedules")}
${navSubmenuItem("genesys-create-master-admin", "Create Master Admin")}
<li class="menu-item-container"><p id="bulk-actions-status" class="command-nav__status">Connect to an organization to run bulk changes.</p></li>`,
    }),
    navGroupDefinition({
      id: "audit-log",
      label: "Audit Log",
      icon: "clipboard",
      bodyHtml: `${navSubmenuItem("genesys-audit-log-viewer", "Audit Log Viewer")}
<li class="menu-item-container"><p id="audit-log-status" class="command-nav__status">Connect to an organization to query audit logs.</p></li>`,
    }),
    navGroupDefinition({
      id: "quick-actions",
      label: "Quick Actions",
      icon: "toolbar-apps",
      bodyHtml: `${navSubmenuItem("genesys-user-notifications", "User Notifications")}
${navSubmenuItem("genesys-queue-notifications", "Queue Notifications")}
${navSubmenuItem("genesys-outbound-notifications", "Outbound Notifications")}
${navSubmenuItem("genesys-notification-message-parser", "Parsed Messages")}
${navSubmenuItem("genesys-quick-action-4", "quickAction#4")}
${navSubmenuItem("genesys-quick-action-5", "quickAction#5")}
${navSubmenuItem("genesys-quick-action-6", "quickAction#6")}
${navSubmenuItem("genesys-quick-action-7", "quickAction#7")}
${navSubmenuItem("genesys-quick-action-8", "quickAction#8")}
${navSubmenuItem("genesys-quick-action-9", "quickAction#9")}
<li class="menu-item-container"><p id="quick-actions-status" class="command-nav__status">Connect to an organization to run quick changes.</p></li>`,
    }),
  ];

  const mainItems = groups.map((group) => group.mainItem).join("\n");
  const submenuPanels = groups.map((group) => group.submenuPanel).join("\n");

  return `<aside id="app-global-nav" class="command-nav app-global-nav submenu-only" data-collapsed="false" data-submenu-open="false">
  <div class="logo-group submenu-only">
    <div class="logo">
      <a href="/" class="logo-image" aria-label="Home">
        <span class="icon-logo-genesys" aria-hidden="true">G</span>
      </a>
    </div>
    <button type="button" id="navigation-menu" class="main-menu-toggle" aria-expanded="true" aria-label="Close Menu">
      <gux-icon class="main-menu-toggle__close" icon-name="close" decorative="true" size="inherit"></gux-icon>
      <gux-icon class="main-menu-toggle__open" icon-name="menu" decorative="true" size="inherit"></gux-icon>
      <span class="main-menu-toggle-menu-text">Menu</span>
    </button>
  </div>
  <div class="nav-container">
    <div class="command-nav__viewport">
      <div class="command-nav__track" id="command-nav-track">
        <div class="command-nav__panel command-nav__panel--main">
          <nav aria-label="Application tools">
            <ul class="command-nav__list">
              ${mainItems}
            </ul>
          </nav>
        </div>
        <div class="command-nav__panel command-nav__panel--sub">
          ${submenuPanels}
        </div>
      </div>
    </div>
  </div>
</aside>`;
};

const layout = ({ title, body, updatedAt, regions = [] }) => {
  const safeTitle = escapeHtml(title);
  const stamp = updatedAt ? new Date(updatedAt).toLocaleString() : null;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;600;700&family=Noto+Sans:wght@300;400;500;600;700&display=swap" />
  <link rel="stylesheet" href="/spark/reset.css" />
  <link rel="stylesheet" href="/spark/global.css" />
  <link rel="stylesheet" href="/spark/ui.css" />
  <link rel="stylesheet" href="/css/genesys-nav-tokens.css" />
  <link rel="stylesheet" href="/css/app-global-nav.css" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/css/notification-message-parser.css" />
</head>
<body>
  <div id="genesys-org-banner" class="command-banner" hidden>
    <div class="banner-container trustee">
      <div class="banner-content">
        <div class="banner-text-content">
          <div class="banner-content-display">
            <div class="banner-text trustee">
              <div class="banner-text-icon">
                <gux-icon icon-name="fa/circle-info-solid" decorative="true" size="inherit"></gux-icon>
              </div>
              <div>
                <p id="genesys-org-banner-text">You are viewing this organization</p>
              </div>
            </div>
          </div>
        </div>
        <div class="banner-buttons-container">
          <div class="primary-button-container">
            <gux-button id="genesys-org-banner-disconnect" type="button" accent="primary">Disconnect</gux-button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="app-shell">
    ${renderAppSidebar()}
    <div class="app-main">
  <header class="site-header">
    <div>
      <h1>${safeTitle}</h1>
      ${stamp ? `<p class="muted">Last updated: ${escapeHtml(stamp)}</p>` : ""}
    </div>

      <div class="region-picker">
        ${renderRegionPicker(regions)}
        <div class="region-picker__auth">
          <div class="field-container region-picker__field">
            <gux-form-field-text-like label-position="above">
              <input slot="input" id="genesys-token" type="password" placeholder="Enter token" aria-label="User token" />
              <label slot="label">Token</label>
            </gux-form-field-text-like>
          </div>
          <gux-button id="genesys-oauth-login" type="button" accent="primary">Authorize (PKCE)</gux-button>
          <gux-button id="genesys-connect" type="button">Connect</gux-button>
          <span id="genesys-status" class="muted" aria-live="polite"></span>
        </div>
      </div>
  </header>
  <main>
    <section class="workspace-content">
      <section id="genesys-results-list" class="export-results-list" aria-live="polite">
        <section class="log-output export-results export-results--empty">
          <div class="export-results__header">
            <h2>Exports</h2>
            <span class="muted">No export loaded.</span>
          </div>
          <div>
            <p class="muted">Select an export from the left panel.</p>
          </div>
        </section>
      </section>
      ${body}
    </section>
  </main>
    </div>
  </div>
  <gux-modal id="genesys-org-picker-modal" size="medium">
    <span slot="title">Select organization</span>
    <div slot="content" class="org-picker-modal">
      <gux-form-field-text-like label-position="above">
        <input slot="input" id="genesys-org-picker-search" type="text" placeholder="Search by organization name or ID" aria-label="Search organizations" />
        <label slot="label">Search</label>
      </gux-form-field-text-like>
      <div id="genesys-org-picker-list" class="org-picker-list" role="listbox" aria-label="Accessible organizations"></div>
      <p id="genesys-org-picker-status" class="muted org-picker-modal__status" aria-live="polite"></p>
      <div class="org-picker-modal__actions">
        <gux-button id="genesys-org-picker-sign-in" type="button" accent="primary">Sign in to primary organization</gux-button>
        <gux-button id="genesys-org-picker-cancel" type="button" accent="secondary">Cancel</gux-button>
      </div>
    </div>
  </gux-modal>
  <gux-modal id="genesys-confirm-modal" size="medium">
    <span slot="title" id="genesys-confirm-modal-title">Confirm Action</span>
    <div slot="content" id="genesys-confirm-modal-body">
      <p class="muted">Review the action details.</p>
    </div>
    <gux-button slot="end-align-buttons" id="genesys-confirm-modal-cancel" type="button" accent="secondary">Cancel</gux-button>
    <gux-button slot="end-align-buttons" id="genesys-confirm-modal-confirm" type="button" accent="primary">Confirm</gux-button>
  </gux-modal>
  <script type="module" src="/js/bootstrap.js"></script>
</body>
</html>`;
};

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const regionsFilePath = path.join(projectRoot, "public", "data", "genesys_regions.json");

const loadRegionsForRender = () => {
  try {
    const regions = JSON.parse(readFileSync(regionsFilePath, "utf8"));
    return Array.isArray(regions) ? regions : [];
  } catch (error) {
    console.error("Failed to load Genesys regions for render:", error.message);
    return [];
  }
};

const renderAppPage = () =>
  layout({
    title: "Genesys PS Tool",
    body: "",
    regions: loadRegionsForRender(),
  });

const renderLogList = ({ logs }) => {
  const items = logs
    .map((log) => {
      const title = escapeHtml(log.title ?? log.id);
      const summary = escapeHtml(log.summary ?? "");
      const time = log.updatedAt ? new Date(log.updatedAt).toLocaleString() : "";
      return `<li class="log-item">
        <div>
          <a class="log-title" href="/logs/${encodeURIComponent(log.id)}">${title}</a>
          ${summary ? `<p>${summary}</p>` : ""}
        </div>
        ${time ? `<span class="muted">${escapeHtml(time)}</span>` : ""}
      </li>`;
    })
    .join("");

  const body = `<section>
    <p class="muted">Dynamic log pages generated by Node.</p>
    <ul class="log-list">
      ${items || "<li>No logs yet. Run npm run seed:logs</li>"}
    </ul>
  </section>`;

  return layout({ title: "Log Output", body, updatedAt: Date.now(), regions: loadRegionsForRender() });
};

const renderLogDetail = ({ log }) => {
  const body = `<article>
    <div class="log-meta">
      <strong>ID:</strong> ${escapeHtml(log.id)}
    </div>
    <div class="log-output">
      <pre>${escapeHtml(log.output)}</pre>
    </div>
  </article>`;

  return layout({
    title: log.title ?? `Log ${log.id}`,
    body,
    updatedAt: log.updatedAt,
    regions: loadRegionsForRender(),
  });
};

export { renderAppPage, renderLogList, renderLogDetail };
