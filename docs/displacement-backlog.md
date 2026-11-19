# Displacement backlog (single prioritized queue)

One ordered list for replacing **GC_API_Helper** and **ACES** with PS Tool. For status legend and full module matrices, see [`displacement-aces-gc-helper.md`](displacement-aces-gc-helper.md). For extension → web completion, see [`migration-matrix.md`](migration-matrix.md).

**Last aligned to:** `main` @ 0.2.0 (+ export nav / documentation ZIP); extension **0.2.1** Open Dashboard is on `feature/extension-org-dashboard` (not a displacement item).

## How to use this list

- Work **top to bottom** within a tier unless an engagement blocks on a specific GCH module (jump using the **GCH module** column).
- **`partial` closures** come before net-new **`planned`** modules — they raise “GCH not required” credibility fastest.
- **FRS full apply**, **full-org clone**, and **Archy publish** are intentionally **below** routine export/bulk work (long horizon).

## Tier 0 — Doc hygiene (no product code)

| # | Item | Outcome |
| --- | --- | --- |
| 0.1 | Refresh GCH module counts in displacement doc | Phase 1 summary reflects registry + `displaced` rows (not “5 of 62”) |
| 0.2 | Mark `exportAll` / Documentation ZIP **done** in success metrics | Operators aren’t told to wait on shipped work |

## Tier 1 — Close `partial` GC Helper gaps (high reuse exports)

**Note:** Interactive exports already discover columns from API JSON (column picker). Tier 1 is **not** “add more picker columns” unless the field is missing from the API payload. **Documentation ZIP** is **wide flatten** (shipped). Remaining Tier 1 items are **missing data**, **file shape**, or **multi-step jobs** (e.g. all group members), not hard-coded column lists.

| Pri | ID | GCH module(s) | PS Tool target | Acceptance |
| ---: | --- | --- | --- | --- |
| 1.1 | `users-columns` | Agent Details, Agent Details Plus | Extend Users export columns (licenses, contact fields, employer expansion) | Column picker includes GCH “wide” set; CSV matches GCH sample for same org |
| 1.2 | `phones-columns` | Phone Details | Enrich Phone export `preferredColumns` + flatten nested fields | PS reps stop exporting phones from GCH for standard PS engagements |
| 1.3 | `skills-languages` | Skills and Languages | Skills export + language/routing skill detail rows | Language columns or child rows documented vs GCH |
| 1.4 | `prompts-columns` | Prompts-User | Prompts export column parity (TTS/text/audio metadata beyond import package) | Import package unchanged; table export matches GCH user prompt workbook needs |
| 1.5 | `groups-members-wide` | Directory Groups, Directory Groups Members | Group export + dedicated **group members all groups** job or multi-select | One action replaces GCH “Directory Groups Members” extract |
| 1.6 | `roles-divisions` | Agent Roles-Div | User Roles export with division breakdown columns | Division-scoped role CSV without separate GCH run |
| 1.7 | `queues-extra` | Queues - Extra | Extend Queues export columns (ACW, media, routing extras) | Documented delta vs current queues table |

## Tier 2 — Phase 1 GC Helper: telephony & numbering (documentation-heavy engagements)

| Pri | ID | GCH module(s) | PS Tool target | Acceptance |
| ---: | --- | --- | --- | --- |
| 2.1 | `dids` | DIDs | Registry export + nav + batch ZIP | List API paginated; in Documentation export default set |
| 2.2 | `did-pools` | DID Pools | Same pattern | |
| 2.3 | `call-routes` | Call Routes | Same pattern | |
| 2.4 | `number-plans` | Number Plans | Same pattern | |
| 2.5 | `extensions` | Extensions | Same pattern | |
| 2.6 | `extension-pools` | Extension Pools | Same pattern | |
| 2.7 | `trunks` | Trunks | Same pattern | |
| 2.8 | `emergency-groups` | Emergency Groups | Same pattern | |

## Tier 3 — Phase 1 GC Helper: Architect & routing metadata

| Pri | ID | GCH module(s) | PS Tool target | Acceptance |
| ---: | --- | --- | --- | --- |
| 3.1 | `data-actions` | Data Actions | Catalog export | Replaces common GCH doc bundle row |
| 3.2 | `flow-details` | Flow Details | Flow metadata list export | No flow JSON publish — metadata only |
| 3.3 | `flow-outcomes` | Flow Outcomes | Catalog export | |
| 3.4 | `flow-milestones` | Flow Milestones | Catalog export | |
| 3.5 | `flow-details-tts` | Flow Details TTS | Export or job (heavier) | Async job if row volume high |
| 3.6 | `triggers` | Triggers | Catalog export | |
| 3.7 | `agent-routing-seg` | Agent Routing - SEG | Catalog export | |

## Tier 4 — Phase 1 GC Helper: org, schedules, outbound, remainder

| Pri | ID | GCH module(s) | PS Tool target | Acceptance |
| ---: | --- | --- | --- | --- |
| 4.1 | `system-roles` | System Roles | Catalog export | Distinct from agent roles export |
| 4.2 | `prompts-system` | Prompts-System | Prompts export mode or second export id | Clearly separated from user prompts |
| 4.3 | `schedules` | Schedule Details, Schedule Groups | Export pair + optional batch | Load Schedules remains import; exports close read gap |
| 4.4 | `oauth-clients` | OAuth Clients | Catalog export | |
| 4.5 | `record-policies` | Record Policies | Catalog export | |
| 4.6 | `presence-definitions` | Presence Status | Catalog export | Feeds ACES menu 14 partial later |
| 4.7 | `outbound-bundle` | Calling Lists, Contact List Filters, Outbound Attempts, CARS, Routes, Rule Sets, Settings | Outbound export group (multiple registry ids) | Documentation ZIP section “Outbound” grows |
| 4.8 | `email-details` | Email Details | Catalog export | |
| 4.9 | `external-contacts` | External Contacts, External Contacts + | Catalog export (+ job for “+” volume) | |
| 4.10 | `topics` | Topics | Catalog export | |
| 4.11 | `skill-groups` | Skill Groups | Catalog export | |
| 4.12 | `agent-contacts-licenses` | Agent Contacts, Agent Licenses | Fold into 1.1 or standalone ids | |
| 4.13 | `remaining-phase1` | All other Phase 1 `planned` rows in displacement matrix | Registry + UI + batch when `batchDefault` | Matrix row → `displaced` or `partial` |

## Tier 5 — Analytics extracts (GCH + interaction data)

| Pri | ID | GCH module(s) | PS Tool target | Acceptance |
| ---: | --- | --- | --- | --- |
| 5.1 | `conv-ids-by-date` | Conv. IDs by Date | Interaction Data → async job + CSV download | Job progress + resumable pattern |
| 5.2 | `conv-ids-by-month` | Conv. IDs by Month | Same | |
| 5.3 | `conversation-details-batch` | Conversation Details | Batch conversation export (not only single-ID viewer) | Distinct from Conversation Data panel |

## Tier 6 — ACES Phase 3 (operator menus, not FRS)

| Pri | ID | ACES hub | PS Tool target | Acceptance |
| ---: | --- | --- | --- | --- |
| 6.1 | `aces-roles-merge` | 6 Update Roles | Bulk workflow: permission merge from spreadsheet col A, dry-run | Preview + audit; no silent overwrite |
| 6.2 | `aces-cleanup-safe` | 8 Clean up | Port **safe** cleanup actions with confirmation | Inventory-driven; one action per PR |
| 6.3 | `aces-routing-csv` | 12–13 CSV & bulk routing | DID / call route CSV import tools (ACES templates) | Template doc + validation |
| 6.4 | `aces-decisions` | 15 Decisions | Decision table export / load CSV | Per ACES operator guide scope |
| 6.5 | `aces-wrap-clone-prompts` | 1–4 Queues, prompts, wrap | Wrap codes clone/create APIs where missing; prompts import gaps | Tied to 1.4 |
| 6.6 | `aces-user-csv-provision` | 5 User menu | Non-destructive CSV user provision subsets | Preview-first; subset of FRS user block |
| 6.7 | `aces-bot-nlu` | 19 Bot NLU | Per-action evaluation | May downgrade to `cannot-displace` per action |

## Tier 7 — GC Helper Phase 2 (QM)

| Pri | ID | GCH module(s) | PS Tool target | Acceptance |
| ---: | --- | --- | --- | --- |
| 7.1 | `qm-design-exports` | Evaluation Details, Survey Details | Form design export CSV/ZIP | OAuth scopes documented |
| 7.2 | `qm-results-jobs` | Evaluation Results, Survey Results | CDA pipeline + checkpoint/resume jobs | Not browser-bound; storage + retention policy |

## Tier 8 — ACES Phase 4 / hybrid (only when engaged)

| Pri | ID | Item | Stance |
| ---: | --- | --- | --- |
| 8.1 | Per-type API clone | ACES menu 7 targets (skills, wrap, queues, …) | `planned` — one object type per epic with preview |
| 8.2 | Data tables target create | Clone rows/schema to second org | Hybrid with existing export |
| 8.3 | GC Helper workbook ingest | ACES menu 18 | Hybrid until provisioning engine exists |
| 8.4 | Archy flows | Publish path | Stay external; PS Tool = triage + metadata export |
| 8.5 | FRS menu 17 full apply | 65+ tabs | **Do not schedule for parity** — tab-group partials only by explicit engagement |
| 8.6 | Full-org clone orchestrator | Clone all beta | **Do not schedule** without product charter + ledger design |

## Explicitly not on this backlog

| Item | Reason |
| --- | --- |
| Extension → web parity | **`done`** per migration matrix (except redesign items) |
| Chat Agent Tester, Mock API, PS operator admin | PS-only; not GCH/ACES displacement |
| FRS rollback UI without apply engine | Cannot-displace register |
| Quick Actions placeholders `quickAction#4–9` | UI cleanup, not displacement |

## Suggested delivery slices (epic groupings)

| Slice | Tiers | Engagement narrative |
| --- | --- | --- |
| **Slice A — “Retire GCH for standard doc bundle”** | 1 + 2 + 3.1–3.4 | PS doc export ZIP covers telephony + Architect metadata + partial closures |
| **Slice B — “Outbound & schedules”** | 4.3–4.7 | Outbound-heavy customers |
| **Slice C — “Analytics extract”** | 5 | QM/ops teams using conv ID harvest |
| **Slice D — “ACES day-two ops”** | 6.1–6.4 | Reduce ACES install for roles/cleanup/routing |
| **Slice E — “QM”** | 7 | Dedicated infrastructure work |

## Tracking rule

When a backlog **ID** ships:

1. Promote the matching row in [`displacement-aces-gc-helper.md`](displacement-aces-gc-helper.md) to `displaced` or `partial`.
2. Add registry + routes + UI (`export-registry.js`, `genesys.js`, `export-catalog-feature.js` as needed).
3. Add or extend `scripts/test-export-*.mjs` when flattening or batch shape changes.
4. Note release in README **Recent changes** if operator-visible.