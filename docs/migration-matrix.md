# PS Tool Migration Matrix

This matrix maps the extension actions in the legacy Genesys Cloud Chrome extension PS Tool to the **Genesys PS Tool** web app (`Genesys_PS_Tool`).

## Status Legend

- `done`: available in the web app
- `next`: explicitly queued
- `planned`: should move after current work
- `redesign`: not a direct port; needs a web-app replacement
- `will not implement`: extension-only behavior intentionally excluded

## Action Matrix

| Extension Action | Source | Category | Web App Target | Status |
| --- | --- | --- | --- | --- |
| `orgMe` | `background.js` | read/report | `/api/genesys/organization` + connected org panel | done |
| `userList` | `background.js` | export | `/api/genesys/users` + export table | done |
| `exportUserRoles` | `users.js` | export | `/api/genesys/users/role-mappings` + export table | done |
| `userSkills` / `skills:proficiency` | `users.js` | export | `/api/genesys/users/skill-mappings` + export table | done |
| `phoneList` | `background.js` | export | `/api/genesys/phones` + export table | done |
| `userRoles` / `exportRoles` | `background.js` | export | `/api/genesys/roles` + role catalog export table | done |
| `queueList` | `background.js` | export | `/api/genesys/queues` + export table | done |
| `queueMemberList` | `background.js` | export | `/api/genesys/queues/:id/members` + selector + export table | done |
| `exportSkills` | `background.js` | export | `/api/genesys/skills` + export table | done |
| `exportPrompts` | `background.js` | export | `/api/genesys/prompts` + export table | done |
| `exportGroups` | `background.js` | export | `/api/genesys/groups` + export table | done |
| `exportGroupUsers` | `background.js` | export | `/api/genesys/groups/:id/members` + selector + export table | done |
| Data tables export | TamperMonkey `dataTablesExporter.js` | export | `/api/genesys/datatables` + multi-select export UI | done |
| `exportAll` | `background.js` | export | batch export workflow in web UI | next |
| `exportToCSV` | `background.js` | export | per-result CSV download on export tables | done |
| `printConversationData` | `background.js` | read/report | searchable JSON viewer panel | done |
| `goToFlowExecution` | `background.js` | read/report | flow execution results page/panel | done |
| `goToInteraction` | `background.js` | read/report | analytics interaction deep link | redesign |
| `disconnect` / `disco` | `background.js` | mutation/workflow | queue analytics query + selectable interaction disconnect | done |
| Priority updater | TamperMonkey `priorityUpdater.js` | mutation/workflow | bulk priority update (same interaction selection as disconnect) | done |
| Phone bulk mover | TamperMonkey `phoneBulkMoverFromList.js` | mutation/workflow | Phone Mover (manual IDs + cached phone picker) | done |
| Phone remover | TamperMonkey `phoneRemover.js` | mutation/workflow | Phone Remover (manual IDs + cached phone picker) | done |
| Phone site migrator | TamperMonkey `phoneSiteMigrator.js` | mutation/workflow | Phone Site Migrator (WebRTC phones only) | done |
| `intentHealth` | `background.js` | read/report | diagnostics page/panel | done |
| `utterances` | `background.js` | read/report | diagnostics page/panel | done |
| `passwordReset` | `background.js` | mutation/workflow | bulk password reset workflow + confirmation modal | done |
| `logoff` / `userLogoff` | `background.js` | mutation/workflow | bulk user logoff workflow with preview | done |
| `bulkAssignRoles` | `background.js` | mutation/workflow | bulk role assignment workflow | done |
| `bulkAssignSkills` | `background.js` | mutation/workflow | bulk skill assignment workflow | done |
| `bulkAssignAutoAnswer` | `background.js` | mutation/workflow | bulk auto answer workflow | done |
| `bulkPhoneBuild` | `background.js` | mutation/workflow | bulk phone provisioning workflow | done |
| `createMasterAdmin` | `background.js` | mutation/workflow | guarded admin creation flow | done |
| `loadSchedules` | `background.js` | mutation/workflow | schedule template selection + import flow | done |
| `callSpoof` | `sidepanel.js` | mutation/workflow | dedicated form with explicit confirmation | done |
| User notifications | TamperMonkey / extension | quick action | User Notifications subscription page | done |
| Queue notifications | TamperMonkey / extension | quick action | Queue Notifications subscription page | done |
| Outbound notifications | TamperMonkey / extension | quick action | Outbound Notifications subscription page | done |
| Parsed notification messages | TamperMonkey / extension | quick action | Parsed Messages panel | done |
| Quick Nav buttons | `sidepanel.js` | chrome-only | configurable web shortcuts/navigation | redesign |
| Auto-enable side panel | `background.js` | chrome-only | not applicable in web app | will not implement |
| Extract token from tab session storage | `sidepanel.js` | chrome-only | manual token entry or OAuth PKCE | will not implement |
| Open tab next to current | `background.js` | chrome-only | standard links/new-window behavior | redesign |

## Supporting APIs (No Direct Extension Button)

| Capability | Web App Target | Status | Notes |
| --- | --- | --- | --- |
| Divisions lookup | `/api/genesys/divisions` | done | used by bulk role assign; session-cached |
| Sites lookup | `/api/genesys/sites` | done | used by phone mover/remover/site migrator; session-cached |
| Data tables lookup | `/api/genesys/datatables` | done | used by data table export; session-cached |
| Password policy lookup | `/api/genesys/password-policy` | done | used by bulk password reset |
| Conversation lookup | `/api/genesys/conversations/:conversationId` | done | conversation data + attributes reports |
| Flow execution lookup | `/api/genesys/flow-executions` | done | flow execution report |
| Outbound call spoof | `/api/genesys/call-spoof` | done | outbound call with spoofed CLID/CNAM |
| Inbound call spoof | `/api/genesys/call-spoof/inbound` | done | inbound DNIS spoof call |
| Bot flow diagnostics | bot flows, utterances, intent health routes | done | intent health + utterances panels |
| Open interactions query | `/api/genesys/analytics/open-interactions/query` | done | bulk disconnect + priority updater (live, not cached) |
| Bulk phone move/delete | `/api/genesys/phones/bulk-move`, `bulk-delete` | done | phone mover, remover, site migrator |
| Bulk priority update | `/api/genesys/conversations/bulk-priority` | done | priority updater |
| Data table export | `/api/genesys/datatables/export` | done | multi-table CSV export |
| Notification topics | `/api/genesys/notifications/availabletopics` | done | topic picker for subscription pages |
| Audit log query | audit log viewer routes | done | query and browse audit events |

## Foundation Decisions

- Business logic in `src/lib/genesys.js` and related helpers.
- Express routes stay thin in `src/routes/genesys.js`.
- Browser behavior in `public/js/*`.
- Chrome/TamperMonkey framework code is **not** ported — only functional behavior.
- Session-scoped caches for infrequently changing data (users in SQLite; phones/sites/divisions/data tables in memory).
- Live queries for interactions and routing state.

## Current App Status

**Done**

- Connection: region picker, OAuth PKCE, manual token, org binding.
- Exports: users, user roles, user skills, phones, roles, queues, queue members, skills, groups, group users, prompts, **data tables**.
- Bulk actions: skill assign, role assign, auto answer, password reset, user logoff, bulk disconnect, **priority updater**, phone build, **phone mover**, **phone remover**, **phone site migrator**, load schedules, create master admin.
- Quick actions: user/queue/outbound notification subscriptions, parsed messages panel.
- Interaction data: conversation JSON, attributes, flow execution, interaction details, call spoof, intent health, bot utterances, audit log viewer.
- Shared UX: confirmation modal, in-place bulk selection, CSV export, progress reporting, session resource caching.

**Next**

- `exportAll` batch export workflow.

**UI cleanup (not migration blockers)**

- Quick Actions sidebar still has placeholder buttons (`quickAction#4` … `#9`).
