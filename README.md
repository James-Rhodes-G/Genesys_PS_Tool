# Genesys PS Tool

Web-based replacement for the legacy Genesys Cloud Chrome extension PS Tool. Connect to an organization, run exports and bulk admin workflows, subscribe to notification topics, and view diagnostics — all through a browser UI built with Genesys Spark (GUX) components.

**Repository name:** `Genesys_PS_Tool`

For extension-to-web migration status, see [`docs/migration-matrix.md`](docs/migration-matrix.md).

## Quick start

```bash
git clone https://github.com/James-Rhodes-G/Genesys_PS_Tool.git
cd Genesys_PS_Tool
npm install
cp .env.example .env
# Edit .env with your OAuth client ID and optional org settings
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env` and configure:

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default `3000`) |
| `JSON_BODY_LIMIT` | Express JSON body limit for large export payloads (default `50mb`) |
| `GENESYS_OAUTH_CLIENT_ID` | OAuth client ID for PKCE login |
| `GENESYS_OAUTH_REDIRECT_URI` | OAuth redirect URI (default `http://localhost:{PORT}/oauth/callback.html`) |
| `GENESYS_OAUTH_SCOPES` | Space-separated OAuth scopes; `organization-authorization:readonly` is always added |
| `GENESYS_PRIMARY_ORG_ID` | Primary org ID used during org-picker OAuth flow |
| `GENESYS_AUTHORIZED_ORGS` | Comma-separated org IDs when trustor lookup is unavailable |
| `GENESYS_AUTHORIZED_ORG_NAMES` | Optional comma-separated display names aligned with `GENESYS_AUTHORIZED_ORGS` |

**Security:** Tokens are held in the browser session (not stored server-side). The server proxies Genesys API calls using credentials sent per request. Never commit `.env`, access tokens, or SQLite database files.

## Features

### Exports

| Tool | Description |
| --- | --- |
| Users | Full user list with column picker and CSV download |
| User Roles | Division-scoped role assignments per user |
| User Skills | Skill proficiency assignments per user |
| Phone | Phone inventory export |
| Roles, Queues, Skills, Groups, Prompts | Standard catalog exports |
| Queue Members / Group Users | Selector-driven member exports |
| **Data Table Export** | Multi-select Architect data tables; exports combined CSV with progress |

### Bulk Actions

| Tool | Description |
| --- | --- |
| Bulk Skill Assign | Assign routing skills to selected users |
| Bulk Role Assign | Assign roles across divisions |
| Bulk Auto Answer | Toggle auto-answer for selected users |
| Password Reset | Bulk password reset with policy validation |
| User Logoff | Force logoff for selected users |
| **Bulk Disconnect** | Load open queue interactions, select rows, disconnect |
| **Priority Updater** | Same interaction selection as Bulk Disconnect; decrementing priority updates |
| Phone Build | Provision WebRTC phones from a template |
| **Phone Mover** | Move phones to another site (manual IDs or cached phone picker) |
| **Phone Remover** | Delete phones (manual IDs or cached phone picker) |
| **Phone Site Migrator** | Migrate all WebRTC phones from one site to another |
| Load Schedules | Import schedule templates with naming rules |

### Call Spoof

| Tool | Description |
| --- | --- |
| Inbound Call Spoof | Allows the user to specify information for the Genesys Call Spoof |
| Outbound Call Spoof | Allows the user to specify information |

### Interaction Data

| Tool | Description |
| --- | --- |
| Conversation Data | Returns the JSON of the conversationId|
| Attributes | Returns the attributes of a participants in the conversationId|
| Flow Execution | Returns links to all flow execution historys of the conversationId|
| Interaction Details | Takes you to the Genesys UI interaction details page |
| Intent Health | selector driven intent health for selected flow |
| Utterances | selector driven utterances for selected flow |

### Audit Log

| Tool | Description |
| --- | --- |
| Audit Log Viewer | Selector Driven Viewer for Audit Logs longer than 14 days |


### Quick Actions (Notifications)

| Tool | Description |
| --- | --- |
| User Notifications | Subscribe to user-scoped notification topics |
| Queue Notifications | Subscribe to queue-scoped topics |
| Outbound Notifications | Subscribe to outbound/settings topics |
| Parsed Messages | In-app panel for parsed WSS notification payloads |
| Create Master Admin | Guarded master admin role creation |

### Organization Dashboard

Read-only landing page after connect. Modular widgets load independently and show cache age / live status.

| Widget | Description |
| --- | --- |
| **Organization Snapshot** | Org name, ID, region, connected user, connection time, and cache ages |
| **Inventory** | Counts for users, roles, queues, skills, groups, prompts, phones, and data tables with Load / Open Export actions |
| **Health Checks** | Users without roles/skills/phones, WebRTC phones without users, empty queues |
| **Organization Limits** | Genesys org limit definitions by namespace; filter by friendly name; shows key, description, default value, and configured value when present |
| **Telephony Metrics** | Live call metrics from `/api/v2/telephony/calls/metrics` |
| **Session Activity** | Bulk workflows and exports run during the current session |

The dashboard opens automatically after a successful connection. Use **Refresh** on individual widgets to reload that widget only.

### Interaction Data & Diagnostics

Conversation JSON, attributes, flow execution, interaction details, inbound/outbound call spoof, intent health, bot utterances, audit log viewer.

## Architecture

```
src/
  server.js              Express entry point, static assets, JSON limits
  routes/
    genesys.js           Thin Genesys API routes
    session.js           Session binding, user cache, export persistence
    logs.js              App shell + legacy log pages
  lib/
    genesys.js           Genesys API helpers and pagination
    genesys-bulk.js      Shared bulk mutation executor
    user-cache.js        Session-scoped user sync orchestration
  data/
    db.js                App logs SQLite
    session-db.js        Session SQLite (connections, exports, user cache)
public/js/
  genesys-app.js         Main UI, export tables, workflow wiring
  genesys-client.js      Browser-side Genesys API client
  session-store.js       Session bind/clear, user sync, export offload
  resource-cache.js      Session-scoped cache (phones, sites, divisions, data tables, roles, queues, skills, groups)
  export-format.js       Shared pipe-separated cell formatting
  export-table-layout.js Resizable export columns
  export-progress.js     Progressive export progress + cache timestamp UI
  bulk-*.js              Bulk workflow modules
  dashboard/             Organization Dashboard widgets and inventory helpers
  datatable-export.js    Data table multi-select export
  notification-*.js      Notification subscription and parsing
```

**Design principles**

- Business logic lives in `src/lib/*`; Express routes stay thin.
- Browser behavior lives in `public/js/*`, not in server-rendered views.
- Chrome extension APIs are replaced with explicit web UI actions (no compatibility shims).

## Authentication

Two connection paths:

1. **PKCE OAuth** — `Authorize (PKCE)` in the connect panel. Redirects through `/oauth/callback.html`, exchanges the code via `/api/genesys/oauth/token`, then binds the session to the selected org.
2. **Manual token** — paste a Genesys access token and region, then connect.

After connecting, the app binds the browser session to the org via `POST /api/session/bind`. Disconnecting or switching orgs clears session data (user cache, resource caches, export results).

## Caching

### Session user cache

Many exports and bulk workflows need the full user list. A **lazy, session-scoped user cache** in SQLite (`data/session.db`) syncs on first need.

- Sync query: `GET /api/v2/users?expand=employerInfo,customAttributes,locations,authorization,skills&sortOrder=ascending&state=any`
- Progress shows `cached {datetime}` or `synced {datetime}` with click-to-refresh
- Cleared on disconnect or org change

### Resource cache (in-memory)

Session-scoped in-memory cache in `public/js/resource-cache.js`. First request hits Genesys; subsequent requests in the same session reuse cached data. Cleared on disconnect or org change.

| Resource | Used by |
| --- | --- |
| Users | SQLite session cache (separate from resource cache) |
| Roles | Role export, bulk role assign, dashboard inventory |
| Queues | Queue export, queue members export, bulk disconnect, priority updater, dashboard inventory/health checks |
| Skills | Skill export, bulk skill assign, dashboard inventory |
| Groups | Group export, group members export, dashboard inventory |
| Phones | Phone export, phone mover/remover/site migrator, dashboard inventory |
| Sites | Phone mover/remover/site migrator |
| Divisions | Bulk role assign, load schedules |
| Data tables | Data table export, dashboard inventory |

**Shared cache:** Loading roles, queues, skills, or groups from the dashboard **Load** button, an export screen, or a bulk workflow all use the same cached copy. A second feature that needs the same list will not refetch from Genesys until you disconnect or switch orgs.

**Not cached:** interactions, conversations, routing state, presence, queue activity, telephony metrics, organization limits docs — always live.

## Export tables

Exports render as collapsible result panels with GUX tables, column picker, and CSV download.

- Multi-value cells use pipe-separated format (` \| ` in CSV, line breaks in HTML)
- Large exports (≥ 200 rows) offload row storage to the session DB
- Resizable columns via drag handles

## Bulk workflows

Bulk actions share:

- In-place selection without scroll jump
- Confirmation modal before destructive/mutating runs
- Progress reporting and success/failure summary tables
- CSV download on result tables

### Bulk Disconnect & Priority Updater

Both use the same interaction selection workflow:

1. Select queue, scope, lookback, media types
2. **Load Interactions** (live analytics query — never cached)
3. Select rows, confirm, execute

Priority Updater decrements priority by 1 for each selected interaction starting from a user-specified value.

## Recent changes

| Date | Change |
| --- | --- |
| 2026-08-05 | **Organization Dashboard** — landing page with six modular widgets; auto-opens after connect |
| 2026-08-05 | **Organization Limits widget** — displays namespace limit docs with friendly-name filter; columns: key, description, default value, configured value |
| 2026-08-05 | **Unified resource caching** — roles, queues, skills, and groups cached once per session and shared across dashboard, exports, and bulk workflows |
| 2026-08-05 | **TamperMonkey admin tools** — data table export, phone mover, phone remover, phone site migrator, interaction priority updater ported natively |
| 2026-08-05 | **GitHub prep** — `.gitignore`, `.env.example`, cleanup script for local DB/logs before push |

## Scripts

| Script | Description |
| --- | --- |
| `npm run start` | Start the server |
| `npm run dev` | Start with nodemon |
| `npm run clean` | Clear and remove local SQLite databases |
| `npm run seed:logs` | Create sample log data (dev) |
| `npm run sw:build` | Verify service worker |
| `npm run test` | Run validation scripts |

### Validation scripts

| Script | Purpose |
| --- | --- |
| `scripts/test-resource-cache.mjs` | Resource cache reuse, phone ID parsing |
| `scripts/test-notification-topics.mjs` | Notification topic grouping/filtering |
| `scripts/test-notification-message-store.mjs` | Parsed message store behavior |

## Preparing for GitHub

Before pushing:

```bash
npm run clean          # Remove local SQLite files (may contain org/user data)
```

Ensure these are **not** tracked:

- `.env` (use `.env.example` as the template)
- `data/*.db` (session cache, export offload, user sync)
- `node_modules/`

The `.gitignore` covers all of the above.

## Security note

`npm audit` may report high-severity vulnerabilities in `tar` pulled in by `node-gyp` during the `sqlite3` install chain. This is a build-time dependency path, not runtime.

Do not commit `.env`, access tokens, OAuth secrets, or local database files.

## License

Private / internal use unless otherwise specified by the repository owner.
