# Genesys PS Tool

Web-based replacement for the legacy Genesys Cloud Chrome extension PS Tool. Connect to an organization, run exports and bulk admin workflows, subscribe to notification topics, and view diagnostics — all through a browser UI built with Genesys Spark (GUX) components.

**Repository name:** `Genesys_PS_Tool`

For extension-to-web migration status, see [`docs/migration-matrix.md`](docs/migration-matrix.md).

Corporate security alignment and remediation details: [`docs/security-audit-corporate-policy.md`](docs/security-audit-corporate-policy.md).

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

### Chrome extension launcher

Load the rebuilt extension from `extension/` (see [`extension/README.md`](extension/README.md)). Set `VAULT_ENCRYPTION_KEY` in `.env` before using extension launch. Full launch flow: [`docs/launch-endpoint.md`](docs/launch-endpoint.md) (`POST /api/launch/start`).

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
| `MOCK_API_MAX_RESPONSE_BODY_BYTES` | Max mock response body size (default `262144`) |
| `MOCK_API_MAX_REQUEST_BODY_BYTES` | Max logged/incoming request body size (default `262144`) |
| `MOCK_API_MAX_HEADERS` | Max configurable response headers (default `20`) |
| `MOCK_API_MAX_HEADER_VALUE_BYTES` | Max response header value size (default `2048`) |
| `MOCK_API_MAX_ENDPOINTS_PER_USER` | Max endpoints per owner (default `25`) |
| `MOCK_API_MAX_REQUEST_LOGS_PER_ENDPOINT` | Rolling request log retention per endpoint (default `1000`) |
| `MOCK_API_INACTIVITY_MS` | Inactivity expiry (default `7200000` — 2 hours) |
| `MOCK_API_MAX_LIFETIME_MS` | Maximum active lifetime (default `86400000` — 24 hours) |
| `MOCK_API_RETENTION_EXPIRED_MS` | Retention before purging deleted/archived endpoints (default `604800000` — 7 days) |
| `MOCK_API_PURGE_INTERVAL_MS` | Background lifecycle purge interval (default `3600000`) |
| `MOCK_API_MAX_DELAY_MS` | Maximum artificial response delay (default `30000`) |
| `VAULT_ENCRYPTION_KEY` | 32-byte hex key for encrypted credential vault (required for extension launch) |
| `LAUNCH_HMAC_SECRET` | Optional HMAC secret for signed extension launch requests |
| `PS_TOOL_ADMIN_USERNAME` | Bootstrap first PS Tool **operator** when `admin.db` has no operators |
| `PS_TOOL_ADMIN_PASSWORD` | Bootstrap operator password (hashed in `admin.db`; rotate after first login) |
| `PS_TOOL_ADMIN_SESSION_TTL_MS` | Operator HttpOnly session lifetime (default 8 hours) |
| `PS_TOOL_ALLOW_MANUAL_AUTH` | Set to `1` to enable web PKCE / manual token UI (default: extension vault only) |
| `PS_TOOL_ALLOW_PASSWORD_EXPORT` | Set to `1` to allow generated passwords in bulk reset CSV (default: off) |
| `SESSION_EXPORT_RETENTION_MS` | Purge aged export rows in `session.db` (default 24 hours) |
| `BACKUP_INCLUDE_SESSION_DB` | Set to `1` to include `session.db` in daily backups (default: excluded) |
| `LAUNCH_BASE_URL` | Public base URL for launch redirects (defaults to request host) |
| `LAUNCH_VAULT_TTL_MS` | Vault entry lifetime (default 8 hours) |
| `LAUNCH_CODE_TTL_MS` | One-time launch code lifetime (default 60 seconds) |
| `WORKER_COUNT` | Max concurrent work items per job (default `4`) |
| `GENESYS_API_CONCURRENCY` | Max concurrent in-flight Genesys HTTP requests (default `4`) |
| `MAX_RETRIES` | Per work-item retry budget (default `5`) |
| `MAX_HTTP_RETRIES` | HTTP-layer retries for 429/5xx before surfacing failure (default `5`) |
| `RETRY_BASE_DELAY_MS` | Exponential backoff base delay (default `1000`) |
| `JOB_TTL_MS` | In-memory job retention after completion (default `86400000` — 24 hours) |
| `JOB_MAX_ITEMS` | Maximum work items per submitted job (default `50000`) |
| `GENESYS_MIN_REQUEST_INTERVAL_MS` | Minimum spacing between Genesys API requests (default `250`) |
| `GENESYS_RATE_LIMIT_MAX_DELAY_MS` | Max backoff delay for rate-limit retries (default `30000`) |

**Security:** Production-style deployments should use **extension launch only** (default: manual token/PKCE hidden until `PS_TOOL_ALLOW_MANUAL_AUTH=1`). The Genesys bearer is encrypted server-side and bound to the `ps_tool_session` cookie after `/launch?code=...`; the extension does not persist tokens. **PS Tool operator login** (separate from Genesys) gates server admin APIs. Never commit `.env`, access tokens, or SQLite database files. See [`docs/security-audit-corporate-policy.md`](docs/security-audit-corporate-policy.md).

## Features

### Exports

| Tool | Description |
| --- | --- |
| Users | Full user list with column picker and CSV download |
| User Roles | Division-scoped role assignments per user |
| User Skills | Skill proficiency assignments per user |
| Phone | Phone inventory export |
| Roles, Queues, Skills, Groups | Standard catalog exports |
| **Prompts** | User prompt export with **Listen {resourceId}** links for recordings, optional recordings ZIP, and an **Export for import** package (see [Prompts export](#prompts-export)) |
| Queue Members / Group Users | Selector-driven member exports |
| **Data Table Export** | Multi-select Architect data tables; exports combined CSV with progress |

#### Prompts export

Always covers every loaded user prompt (including rows offloaded to the session DB); there is no row selection. System prompts are not included.

| Action | Result |
| --- | --- |
| Media URI column | Each resource with a recording renders as a **Listen {resourceId}** link. The CSV keeps the raw `mediaUri` URL(s). |
| **Export CSV** | Normal table CSV. With **Include recordings (ZIP)** checked, also downloads `{org}_prompts_recordings_{date}.zip` containing `{promptName}_{resourceId}.wav` files (backup naming). |
| **Export for import** | Downloads `{org}_prompts_import_{date}.zip` for Architect **Prompts > Import**: `prompts_bulk_import.csv` plus every recording. |

The import package follows the Genesys bulk prompt import rules ([CSV format](https://help.genesys.cloud/articles/format-guidelines-csv-file-bulk-prompt-import/), [file naming](https://help.genesys.cloud/articles/prompt-naming-conventions-bulk-import/)):

- WAV files are named `prompt_user_{PromptName}_{languageCode}.wav` (for example `prompt_user_Welcome_en-us.wav`).
- CSV columns are `Name`, `Type` (`user`), `Description`, then `tts_{lang}`, `audio_{lang}`, `text_{lang}` for each language found (language codes keep hyphens, for example `tts_en-us`). `audio_*` holds the exact WAV filename; `tts_*` and `text_*` come from each resource's `ttsString` and `text`.
- Extract the ZIP, then in Architect select the CSV **and all WAV files** (not the folder). Prompt names must also satisfy Genesys naming rules (letters, numbers, underscores; no leading digit).

Recordings are downloaded server-side via `POST /api/genesys/prompts/export-package` (ZIP built with `jszip`). Only public `https` media URLs are fetched, at most 4 at a time, and the Genesys bearer token is sent only to hosts under the org's Genesys domain. If any recording cannot be downloaded, the status line reports how many are missing from the ZIP.

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
| Phone Build | Provision WebRTC phones from a template; excludes users who already have a WebRTC phone |
| **Phone Mover** | Move phones to another site (manual IDs or cached phone picker); radial progress, one phone per request |
| **Phone Remover** | Delete phones (manual IDs or cached phone picker); radial progress, one phone per request |
| **Phone Site Migrator** | Migrate all phones from one site to another; radial progress, one phone per request |
| Load Schedules | Import schedule templates with naming rules |

### Call Spoof

| Tool | Description |
| --- | --- |
| Inbound Call Spoof | Allows the user to specify information for the Genesys Call Spoof |
| Outbound Call Spoof | Allows the user to specify information |

### Interaction Data

| Tool | Description |
| --- | --- |
| Conversation Data | Conversation JSON in a collapsible tree (root expanded; nested sections fold); Expand all / Collapse all |
| Attributes | Conversation and participant attributes table (click column headers to sort; CSV matches sort order) |
| Flow Execution | Query flow instances by conversation ID, then open in Genesys or the PS Tool Architect Execution Timeline Viewer |
| Interaction Details | Takes you to the Genesys UI interaction details page |
| Intent Health | selector driven intent health for selected flow |
| Utterances | selector driven utterances for selected flow |

### Audit Log

| Tool | Description |
| --- | --- |
| Audit Log Viewer | Service/entity/action filters; async Genesys audit query; **100 events per page** with **Next page**; **Download CSV** exports all pages for the query |

### PS Tool Admin & Mock API

**Operator login** (`PS_TOOL_ADMIN_*` bootstrap or existing operator in `admin.db`) is required for server admin surfaces below. Genesys org connection alone is not sufficient.

| Surface | Operator login | Description |
| --- | --- | --- |
| Operations Dashboard, Server Health, Storage, Usage, Sessions & Vault, Launch Monitor, Dangerous Actions, **PS Tool Audit Log** (25/page), Endpoint Registry | Required | Server telemetry and cross-session controls |
| **Mock API** (management UI) | Vault session only | Create mock HTTP endpoints for Data Actions, Architect, and integrations; inspect request history |
| **Genesys Audit Log Viewer** | Vault session only | Org audit queries (see Audit Log above) |

Mock endpoints are reachable at `/mockAPI/{userpart}/{endpointSlug}` (no PS Tool auth required for invocation). Management requires a connected session and Genesys credentials.

**Ownership:** Endpoints are scoped to the authenticated user (`userpart` from email), not to the connected organization. The org active at creation time is stored as metadata only. Switching orgs does not hide or change access to your endpoints.

**Lifecycle:** draft → active → expired (2h inactivity or 24h max lifetime) → archived/deleted. Expired endpoints can be restored. Deleted/archived records are purged after the configured retention period.

**Request logging:** Every invocation is logged (rolling 1000 requests per endpoint). Authorization, cookie, and token headers are redacted before storage.

**Management routes** (authenticated):

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/mock-api/config` | GET | Presets, limits, allowed methods/content types/delays |
| `/api/mock-api/context` | GET | Owner userpart and public URL prefix |
| `/api/mock-api/endpoints` | GET | List endpoints (`?group=active\|expired\|archived`) |
| `/api/mock-api/endpoints` | POST | Create endpoint |
| `/api/mock-api/endpoints/:id` | GET | Get endpoint |
| `/api/mock-api/endpoints/:id` | PUT | Update endpoint |
| `/api/mock-api/endpoints/:id/activate` | POST | Activate or reactivate |
| `/api/mock-api/endpoints/:id/archive` | POST | Archive endpoint |
| `/api/mock-api/endpoints/:id/restore` | POST | Restore expired/archived endpoint |
| `/api/mock-api/endpoints/:id/clone` | POST | Clone endpoint |
| `/api/mock-api/endpoints/:id` | DELETE | Soft-delete endpoint |
| `/api/mock-api/endpoints/:id/logs` | GET | Request history for endpoint |
| `/api/mock-api/logs/:logId` | GET | Single request log entry |

**Public invocation route** (no auth): `ALL /mockAPI/:userpart/:endpointSlug`

### Architect Execution Timeline Viewer

Adds a card-based execution timeline on top of the existing Flow Execution lookup. The original Genesys Architect link remains available on the Flow Selection page.

**Workflow**

1. Enter a Conversation ID in Interaction Data.
2. Click **Flow Execution** to query `/api/v2/flows/instances/query`.
3. Review the Flow Selection page (always shown, even for a single result).
4. Choose **Open in Genesys** or **Open in PS Tool**.

**PS Tool viewer behavior**

- Downloads rendered execution JSON once via the async Genesys job workflow:
  - `GET /api/v2/flows/instances/{instanceId}` — start download job
  - `GET /api/v2/flows/instances/jobs/{jobId}` — poll job status
  - `GET /api/v2/downloads/{downloadId}?issueRedirect=false` — resolve signed URL
- Parses JSON into an internal execution model on the server; the UI never consumes raw Genesys JSON.
- Genesys rendered execution documents (`{ flow: { execution: [...] } }`) are converted automatically before timeline rendering.
- Caches the parsed model in browser session memory while the viewer is open.
- Supports chronological cards, task/common module grouping, search highlighting, variable tracking, and error navigation without re-downloading or re-parsing.

**Routes**

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/genesys/flow-executions` | POST | Query flow instances by `conversationId` |
| `/api/genesys/flow-executions/:instanceId/download` | POST | Download execution JSON, parse, return internal model |

**Parser modules (`src/lib/`)**

| Module | Purpose |
| --- | --- |
| `flow-execution-download.js` | Async Genesys download job polling and signed URL fetch |
| `flow-execution-genesys-parser.js` | Genesys rendered `{ flow.execution }` document → internal action tree |
| `flow-execution-parser.js` | Raw execution JSON → internal execution model |
| `flow-execution-action-registry.js` | Action type → display metadata |
| `flow-execution-analysis.js` | Search, error navigation, variable tracking helpers |

**UI modules (`public/js/`)**

| Module | Purpose |
| --- | --- |
| `flow-execution-feature.js` | Flow Selection page + timeline viewer |
| `flow-execution-client.js` | Browser API client |
| `flow-execution-analysis.js` | Browser-side search/navigation helpers |

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
    session.js           Session binding, user cache, export persistence, export audit
    launch.js            Extension launch (start/pair/handoff), vault consume
    admin.js             Operator-gated admin APIs
    app-config.js        Public security policy (`GET /api/app/security-policy`)
    mock-api.js          Mock API management + public invocation routes
    logs.js              App shell + legacy log pages
  lib/
    genesys.js           Genesys API helpers and pagination
    prompts-export-package.js Prompt recordings/import-package ZIP builder (URL allowlist, concurrency cap)
    mock-api.js          Mock endpoint business logic and invocation
    mock-api-config.js   Mock API limits and lifecycle defaults
    flow-execution-download.js Async flow execution download workflow
    flow-execution-parser.js Execution JSON parser and internal model builder
    flow-execution-action-registry.js Action type display registry
    flow-execution-analysis.js Search, error, and variable tracking helpers
    genesys-bulk.js      Shared bulk mutation executor
    user-cache.js        Session-scoped user sync orchestration
  data/
    db.js                App logs SQLite
    session-db.js        Session SQLite (connections, exports, user cache)
    mock-api-db.js       Mock endpoints and request logs SQLite
public/js/
  genesys-app.js         Main UI, export tables, workflow wiring
  genesys-client.js      Browser-side Genesys API client
  mock-api-feature.js    Mock API management UI
  mock-api-client.js     Browser client for mock API routes
  flow-execution-feature.js Architect Execution Timeline Viewer
  flow-execution-client.js Browser client for flow execution routes
  session-store.js       Session bind/clear, user sync, export offload
  resource-cache.js      Session-scoped cache (phones, sites, divisions, data tables, roles, queues, skills, groups)
  export-format.js       Shared pipe-separated cell formatting and CSV escaping
  prompts-export.js      Prompts export: Listen links, Genesys bulk-import CSV, recording naming
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

### Genesys org access (CS workflows)

1. **Extension launch (recommended)** — Chrome extension calls `POST /api/launch/start`; web app opens in **vault mode** with Genesys API calls authenticated via the server session cookie (no bearer token in `localStorage`).
2. **PKCE OAuth / manual token (optional)** — Enabled only when `PS_TOOL_ALLOW_MANUAL_AUTH=1`. PKCE uses `/oauth/callback.html` and `/api/genesys/oauth/token`; manual token uses the connect panel.

After connecting, the app binds the browser session to the org via `POST /api/session/bind`. Disconnecting or switching orgs clears session data (user cache, resource caches, export results) and vault credentials (`POST /api/launch/disconnect`).

Policy flags are exposed to the UI at `GET /api/app/security-policy`.

### PS Tool operator access (server admin)

Local operator username/password → `POST /api/admin/login` → HttpOnly `ps_tool_admin_session` cookie. Bootstrap from `PS_TOOL_ADMIN_USERNAME` / `PS_TOOL_ADMIN_PASSWORD` when no operators exist. This does **not** grant Genesys org permissions; it gates PS Tool server administration only.

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
| Phones | Phone export, phone build, phone mover/remover/site migrator, dashboard inventory |
| Sites | Phone mover/remover/site migrator |
| Divisions | Bulk role assign, load schedules |
| Data tables | Data table export, dashboard inventory |

**Shared cache:** Loading roles, queues, skills, or groups from the dashboard **Load** button, an export screen, or a bulk workflow all use the same cached copy. A second feature that needs the same list will not refetch from Genesys until you disconnect or switch orgs.

**Phone cache invalidation:** After a successful Phone Build, Phone Mover, Phone Remover, or Phone Site Migrator run, the in-memory phone cache is cleared so the next open of those tools (or a phone export) refetches current phone assignments from Genesys.

**Not cached:** interactions, conversations, routing state, presence, queue activity, telephony metrics, organization limits docs — always live.

## Export tables

Exports render as collapsible result panels with GUX tables, column picker, click-to-sort column headers, and CSV download (sort order matches the table).

- Multi-value cells use pipe-separated format (` \| ` in CSV, line breaks in HTML)
- Large exports (≥ 200 rows) offload row storage to the session DB
- Resizable columns via drag handles

## Bulk workflows

Bulk actions share:

- In-place selection without scroll jump
- Confirmation modal before destructive/mutating runs
- Progress reporting and success/failure summary tables
- CSV download on result tables

### Bulk phone workflows

Phone Build, Phone Mover, Phone Remover, and Phone Site Migrator share a radial progress ring with per-item status (`25 / 100 phones (25%) — 24 succeeded, 1 failed`). Each mutation is sent one phone (or one user for Phone Build) at a time to avoid browser timeouts on large jobs.

- **Phone Build** loads users and phones together, then hides users who already have a WebRTC phone (`phone.webRtcUser.id`). User records do not include phone assignment directly.
- **Phone Site Migrator** moves every phone assigned to the selected source site.
- After a successful run, the session phone cache is invalidated so pickers reflect the latest Genesys state.

### Bulk Disconnect & Priority Updater

Both use the same interaction selection workflow:

1. Select queue, scope, lookback, media types
2. **Load Interactions** (live analytics query — never cached)
3. Select rows, confirm, execute

Priority Updater decrements priority by 1 for each selected interaction starting from a user-specified value.

## Recent changes

| Date | Change |
| --- | --- |
| 2026-10-16 | **Corporate security remediations** — `POST /api/launch/start`, vault-only web default, session retention/backup scope, export audit, operator admin login; see [`docs/security-audit-corporate-policy.md`](docs/security-audit-corporate-policy.md) |
| 2026-10-27 | **Prompts export** — Listen links for recordings, optional recordings ZIP on Export CSV, and **Export for import** package (Genesys bulk prompt import CSV + `prompt_user_*` WAV files) |
| 2026-10-22 | **Genesys Audit Log Viewer** — cursor-based pagination (100/page), CSV download fetches all result pages |
| 2026-08-20 | **Bulk phone hotfix** — radial progress for build/move/remove/migrate; one item per request; WebRTC site move uses minimal PUT body; Phone Build excludes users with existing WebRTC phones; phone cache invalidated after successful phone mutations |
| 2026-08-10 | **Architect Execution Timeline Viewer** — flow selection page, async download, parser, card timeline, search, variable tracking, error navigation |
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
| `scripts/test-resource-cache.mjs` | Resource cache reuse, phone ID parsing, targeted phone cache invalidation |
| `scripts/test-phone-site-move.mjs` | WebRTC site-move payload builder and bulk progress guidance |
| `scripts/test-notification-topics.mjs` | Notification topic grouping/filtering |
| `scripts/test-notification-message-store.mjs` | Parsed message store behavior |
| `scripts/test-mock-api.mjs` | Mock API slug normalization, redaction, lifecycle, validation |
| `scripts/test-prompts-export.mjs` | Prompts import CSV/WAV naming, Listen cells, recording URL allowlist, ZIP builder (flat names, token scoping, failure reporting) |
| `scripts/test-flow-execution-parser.mjs` | Execution parser timeline, variables, search, and error navigation |
| `scripts/test-launch-security.mjs` | Launch schema validation (`validateStartBody`), HMAC, vault encryption, rate limiting |
| `scripts/test-admin-operator-auth.mjs` | Operator password hash, admin session cookie, gated feature IDs |
| `scripts/test-admin.mjs` | Admin event store and dangerous-action filters |

## Concurrent job processing

Long-running bulk operations can be submitted as background jobs. The server returns a job ID immediately; clients poll for progress.

### Submit a job

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  --cookie "ps_tool_session=<vault session from extension launch>" \
  -H "x-genesys-region: us-east-1" \
  -H "x-genesys-token: $TOKEN" \
  -d '{
    "type": "bulk-skill-assign",
    "payload": {
      "userIds": ["user-id-1", "user-id-2"],
      "skills": [{ "id": "skill-id", "proficiency": 5.0 }]
    }
  }'
```

Response:

```json
{ "jobId": "abc123", "status": "queued" }
```

### Poll job status

```bash
curl http://localhost:3000/api/jobs/{jobId} \
  -H "x-genesys-region: us-east-1" \
  -H "x-genesys-token: $TOKEN"
```

### Fetch results (after completion)

```bash
curl "http://localhost:3000/api/jobs/{jobId}/results?offset=0&limit=100" \
  -H "x-genesys-region: us-east-1" \
  -H "x-genesys-token: $TOKEN"
```

Existing synchronous endpoints (for example `POST /api/genesys/users/bulk-skill-assign`) remain unchanged. See [`docs/concurrent-processing.md`](docs/concurrent-processing.md) for architecture details and migration guidance.

### Testing concurrency locally

```bash
WORKER_COUNT=4 GENESYS_API_CONCURRENCY=4 npm test
WORKER_COUNT=4 GENESYS_API_CONCURRENCY=4 npm run dev
```

Compare `metrics.itemsPerSecond` and `metrics.durationMs` in completed job responses across different `WORKER_COUNT` values.

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
