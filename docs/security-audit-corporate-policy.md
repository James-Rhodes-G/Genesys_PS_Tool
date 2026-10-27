# PS Tool Security Audit — Corporate Policy Alignment

**Document version:** 2.1  
**Date:** 2026-10-22  
**Scope:** Genesys PS Tool (Node web app + Chrome extension), assessed against Customer Success security reminders (local credential storage, approved auth, data location, least privilege).  
**Reference policy:** Internal CS security email (Oct 2026); [Genesys Cloud Auth Orgs (Confluence)](https://genesys-confluence.atlassian.net/wiki/spaces/CusCare/pages/69023960/Genesys+Cloud+Auth+Orgs).

---

## Executive summary

This audit covers three **priority risks** and documents **code remediations** shipped in this release, in addition to **local operator login** for PS Tool server administration.

| Risk | Theme | Severity | Status after remediations |
| --- | --- | --- | --- |
| **1** | Customer / session credentials on user machines | High | **Mitigated** for production defaults: extension-only launch path, no extension token persistence, vault-only web API, manual auth opt-in |
| **2** | Customer data persisted on disk (SQLite, backups) | High | **Mitigated:** shorter export retention, purge on credential expiry/disconnect, orphan cache purge, `session.db` excluded from backups by default |
| **3** | Customer data in motion (CSV, passwords in exports) | High (policy-dependent) | **Mitigated:** password-in-CSV gated by server policy; CSV downloads audited server-side; CS exports still require governance |

**Strengths:** Encrypted Genesys token vault (AES-256-GCM), cookie-bound vault session for web APIs, launch hardening (HMAC, rate limits, `POST /api/launch/start`), log redaction, operator HttpOnly admin session, **security policy endpoint** for client behavior.

**Residual governance:** Security approval of deployment model (laptop vs shared host), which CSV/export types are permitted, and alignment of extension `gcui_auth` usage with Genesys auth guidance.

---

## Remediation summary (what changed in code)

| Area | Implementation |
| --- | --- |
| **Extension launch** | `POST /api/launch/start` — token sent per launch only; returns one-time `launchUrl`; no `linkToken` / `pairContext` in `chrome.storage` — [`extension/js/launch.js`](../extension/js/launch.js), [`src/routes/launch.js`](../src/routes/launch.js) |
| **Extension UX** | Token display/copy removed from side panel — [`extension/sidepanel.html`](../extension/sidepanel.html) |
| **Web manual auth** | Default **off**; `PS_TOOL_ALLOW_MANUAL_AUTH=1` to enable PKCE/token UI — [`src/lib/security-policy.js`](../src/lib/security-policy.js), [`public/js/genesys-app.js`](../public/js/genesys-app.js) |
| **API credential source** | `/api/genesys/*`, `/api/jobs`, `/api/mock-api/*` reject client tokens unless manual auth allowed; vault session required otherwise (`VAULT_SESSION_REQUIRED`) — [`src/lib/genesys-request-credentials.js`](../src/lib/genesys-request-credentials.js) |
| **Session UX** | Modal on expired vault session — [`public/js/api-error-modal.js`](../public/js/api-error-modal.js), [`public/js/genesys-client.js`](../public/js/genesys-client.js) |
| **Data at rest** | Disconnect clears credentials **and** session export/cache; orphan purge; export retention default 24h — [`src/data/session-db.js`](../src/data/session-db.js), [`src/server.js`](../src/server.js) |
| **Backups** | `session.db` omitted unless `BACKUP_INCLUDE_SESSION_DB=1` — [`src/lib/admin-jobs.js`](../src/lib/admin-jobs.js) |
| **Password in CSV** | UI hidden unless `PS_TOOL_ALLOW_PASSWORD_EXPORT=1` — [`public/js/bulk-password-reset-feature.js`](../public/js/bulk-password-reset-feature.js) |
| **Export audit** | `POST /api/session/export-audit` logs type, row count, password column flag, and for prompts the export kind (`table_csv`, `recordings_zip`, `import_package`) and recording count — [`src/routes/session.js`](../src/routes/session.js) |
| **Prompt recording downloads** | `POST /api/genesys/prompts/export-package` fetches recordings server-side: public `https` hosts only (no IP literals/localhost), 4 concurrent, Genesys bearer sent only to hosts under the org's Genesys domain, ZIP entry names flattened — [`src/lib/prompts-export-package.js`](../src/lib/prompts-export-package.js) |
| **Admin login** | Rate limit on `POST /api/admin/login` — [`src/routes/admin.js`](../src/routes/admin.js) |
| **Policy API** | `GET /api/app/security-policy` — [`src/routes/app-config.js`](../src/routes/app-config.js) |
| **Mock API same-origin** | Forbidden response headers (e.g. `Set-Cookie`, `Location`); forced sandbox CSP on mock responses — [`src/lib/mock-api.js`](../src/lib/mock-api.js) |
| **Session cookie** | HMAC-signed `ps_tool_session`; rotation on vault launch and org bind; `Secure` / `__Host-` on HTTPS — [`src/middleware/session.js`](../src/middleware/session.js), [`src/lib/session-token.js`](../src/lib/session-token.js) |
| **Security headers** | CSP (report-only by default), `frame-ancestors`, HSTS on HTTPS — [`src/middleware/security-headers.js`](../src/middleware/security-headers.js) |
| **Launch hardening** | HMAC required in production; replay nonces; atomic launch-code consume — [`src/lib/launch-validation.js`](../src/lib/launch-validation.js), [`src/data/session-db.js`](../src/data/session-db.js) |
| **Org bind** | `/api/session/bind` verifies org via vault credentials or Genesys token — [`src/routes/session.js`](../src/routes/session.js) |
| **Dependency audit** | `npm run audit:prod` — [`package.json`](../package.json) |

**Tests:** `npm test` includes `scripts/test-launch-security.mjs`, `scripts/test-security-session.mjs`, and `scripts/test-mock-api.mjs`.

---

## Admin operator login (server administration)

Separate from Genesys org access, PS Tool enforces **local operator login** for server administration:

- **Backend:** Operator accounts in `admin.db` (scrypt); HttpOnly `ps_tool_admin_session`; `requireAdminSession` on `/api/admin/*` except login/logout/session GET and `POST /api/admin/activity`.
- **Frontend:** Ten admin surfaces gated; Genesys Audit Log Viewer and user Mock API remain available with vault session only.
- **Bootstrap:** `PS_TOOL_ADMIN_USERNAME` / `PS_TOOL_ADMIN_PASSWORD` when no operators exist.

Evidence: [`src/middleware/admin-session.js`](../src/middleware/admin-session.js), [`src/routes/admin.js`](../src/routes/admin.js), [`public/js/admin/admin-operator-ui.js`](../public/js/admin/admin-operator-ui.js).

---

## Risk 1 — Credentials and secrets on the local machine

### Issue

Corporate policy prohibits storing **customer** credentials and tokens on local machines. PS Tool previously persisted Genesys bearer tokens in `localStorage`, OAuth PKCE state, extension `chrome.storage` (`pairContext`, `linkToken`), and showed copyable tokens in the side panel.

### Resolution (implemented)

| Control | Resolution |
| --- | --- |
| Extension token storage | **Removed.** Each launch uses `POST /api/launch/start` with in-memory token from the Genesys tab only. |
| Extension token copy UX | **Removed** from side panel. |
| Web manual login / PKCE | **Disabled by default.** Header auth UI hidden; connect blocked unless `PS_TOOL_ALLOW_MANUAL_AUTH=1`. |
| Web API tokens in headers/body | **Rejected** when manual auth is off; server uses vault credentials from HttpOnly session only. |
| Vault launch page | Still sets org/user metadata in `localStorage` and **does not** store bearer token (`ps_tool_token` removed on consume). |
| Server tokens | Encrypted in `session.db` for active vault TTL (unchanged; required for server-side Genesys API calls). |
| Host `.env` | Still holds `VAULT_ENCRYPTION_KEY`, optional bootstrap operator password (operational control). |
| PS Tool admin | Operator password not stored in browser; HttpOnly session cookie. |

### Residual risk / follow-up

- OAuth PKCE **localStorage** still used when `PS_TOOL_ALLOW_MANUAL_AUTH=1` (dev/legacy only).
- Org/user display fields remain in `localStorage` in vault mode (not bearer secrets).
- Confirm extension `gcui_auth` usage with **Genesys Cloud Auth Orgs** guidance.
- Production: HTTPS, `LAUNCH_HMAC_SECRET`, rotate bootstrap operator password.

---

## Risk 2 — Customer data at rest on local / server disk

### Issue

PS Tool caches org user JSON and export rows in SQLite (`session.db`). Backups previously copied full DB files including customer-heavy tables.

### Resolution (implemented)

| Control | Resolution |
| --- | --- |
| Export retention | Lifecycle job uses `SESSION_EXPORT_RETENTION_MS` (default **24 hours**) for `purgeOldExportData`. |
| Credential expiry | `purgeExpiredSessionCredentials` clears credentials **and** `clearSessionData` for affected sessions. |
| Disconnect | `POST /api/launch/disconnect` clears credentials and session export/cache rows. |
| Orphan data | `purgeOrphanSessionCache` removes cache/export rows without active session connections. |
| Backups | Daily backup **excludes** `session.db` unless `BACKUP_INCLUDE_SESSION_DB=1`. |
| Admin visibility | Session lists and storage metrics remain **operator-gated** (unchanged). |

### Residual risk / follow-up

- While a vault session is active, `cached_users` and export rows still exist on the Node host (required for UX/job resume).
- `mock-api.db` and `admin.db` may still contain operational metadata.
- **Hosting decision:** prefer approved shared server with disk encryption vs rep laptop.
- Optional: further minimize cached user fields; field-level encryption for export JSON on approved hosts.

---

## Risk 3 — Customer data in motion (exports, downloads, sensitive payloads)

### Issue

PS Tool delivers CSV downloads and bulk workflows. Bulk password reset could include generated passwords in results/CSV.

### Resolution (implemented)

| Control | Resolution |
| --- | --- |
| Password in CSV/results | Checkbox and password column **hidden by default**; enabled only when `PS_TOOL_ALLOW_PASSWORD_EXPORT=1` on server. |
| CSV download audit | Client calls `POST /api/session/export-audit` with export type, row count, and whether password column was included (prompt exports also send export kind and recording count); recorded in PS Tool audit log. |
| Genesys Audit Log Viewer | Remains **public** (vault session). Results paginated via Genesys `cursor` (100/page in UI); **Download CSV** re-fetches all pages for the query. |
| PS Tool Audit Log (admin) | Operator-gated; paginated at 25 events/page via `/api/admin/events?limit=&offset=`. |
| User Mock API | Remains **public** under vault session; admin registry operator-gated. |
| Manual auth exports | Blocked unless manual auth explicitly enabled (same vault gate as APIs). |

### Residual risk / follow-up

- CSV files still download to the user’s browser Downloads folder when exports run — **DLP/governance** must approve which roles and machines may export. This includes prompt recording ZIPs (customer audio) from the Prompts export.
- Audit log viewer and flow downloads still move customer data in motion; training and ticket storage rules apply.
- Bulk reset still sends passwords to Genesys API over HTTPS (required for the operation); not written to CSV by default.

---

## Environment flags (production defaults)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PS_TOOL_ALLOW_MANUAL_AUTH` | off | Allow token/PKCE web login |
| `PS_TOOL_ALLOW_PASSWORD_EXPORT` | off | Allow generated passwords in bulk reset CSV |
| `SESSION_EXPORT_RETENTION_MS` | 86400000 (24h) | Purge aged export rows |
| `BACKUP_INCLUDE_SESSION_DB` | off | Include customer-heavy DB in backups |
| `LAUNCH_HMAC_SECRET` | optional (recommended) | Sign extension launch requests |
| `PS_TOOL_ADMIN_*` | — | Operator bootstrap and session TTL |

See [`.env.example`](../.env.example).

---

## Admin gating reference

### Public (Genesys vault / session — no operator login)

| Feature ID | Purpose |
| --- | --- |
| `genesys-audit-log-viewer` | Query org audit via Genesys API |
| `genesys-mock-api` | User mock endpoint CRUD |

**APIs:** `/api/genesys/audits/*`, `/api/mock-api/*`, `POST /api/admin/activity`, `GET /api/app/security-policy`, `POST /api/session/export-audit` (bound session).

### Operator login required (10 surfaces)

Operations Dashboard, Endpoint Registry, PS Tool Audit Log, Activity Timeline, Dangerous Actions, Server Health, Launch Monitor, Sessions & Vault, Usage Analytics, Storage Detail.

**APIs:** `/api/admin/*` (except login/logout/session GET and `POST /api/admin/activity`).

---

## Questions for Information Security / leadership

1. Is PS Tool (web + extension) an **approved** CS tool for production customer orgs?
2. Is **local Node + SQLite** on company laptops permitted, or must PS Tool run only on a **shared approved host**?
3. Are **CSV exports** and Genesys **Audit Log Viewer** queries permitted under current DLP policy?
4. Does extension `gcui_auth` + vault launch match **Genesys Cloud Auth Orgs** guidance?
5. Should **Mock API** remain available to all connected users in production?

---

## Appendix — Policy mapping (email bullets)

| Policy reminder | PS Tool control | Risk |
| --- | --- | --- |
| No customer credentials on local machine | Extension start launch; no token in extension storage; vault-only API default | 1 |
| Approved Genesys auth | Extension reads active Genesys session; manual OAuth opt-in | 1 / governance |
| No customer data outside approved locations | Retention, disconnect purge, backup exclude `session.db` | 2 |
| Least privilege | Genesys RBAC + operator vs CS separation | 1, admin |
| Approved tools / equipment | Deployment model + env flags | All |

---

*Document reflects codebase after Risk 1–3 remediations and admin operator login. Re-validate when hosting model or export governance changes.*
