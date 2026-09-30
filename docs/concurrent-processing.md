# Concurrent Processing Framework

This document describes the reusable concurrency framework for PSTools bulk Genesys Cloud operations.

## Architecture

```text
PSTool Action / API Client
        |
   Job Manager
        |
   Work Queue
        |
  Worker Pool (WORKER_COUNT)
        |
  Job Handler (per action type)
        |
  Genesys API Client
        |
  Token Manager + Shared Rate Limiter (GENESYS_API_CONCURRENCY)
        |
  Genesys Cloud API
```

## Core components

| Component | Location | Purpose |
| --- | --- | --- |
| Worker pool | `src/lib/concurrency/worker-pool.js` | Bounded concurrent item processing with retries |
| Job manager | `src/lib/jobs/job-manager.js` | Creates jobs, orchestrates workers, tracks progress |
| Job store | `src/lib/jobs/job-store.js` | In-memory job state (swappable interface) |
| Work queue | `src/lib/jobs/work-queue.js` | Per-job work items (swappable interface) |
| Genesys API client | `src/lib/genesys/api-client.js` | Centralized HTTP with auth, logging, error normalization |
| Token manager | `src/lib/genesys/token-manager.js` | Cached token with refresh mutex |
| Rate limiter | `src/lib/genesys-rate-limit.js` | Shared concurrency cap, 429/5xx/401 handling |

## Job API

### POST `/api/jobs`

Submit a job and receive `{ jobId, status: "queued" }` immediately.

Supported types are registered in `src/lib/jobs/handlers/index.js`.

Registered job types: `bulk-skill-assign`, `bulk-role-assign`, `bulk-auto-answer`, `bulk-password-reset`, `bulk-logoff`, `bulk-disconnect`, `bulk-priority-update`, `bulk-phone-build`, `bulk-phone-delete`, `bulk-phone-move`, `bulk-load-schedules`, `user-role-export`, `user-skill-export`

Export jobs support partial result paging while running (`GET /api/jobs/:jobId/results?offset=&limit=`) and single-item lookup (`?userId=`). Large exports can stream pages into session storage via `POST /api/session/exports/init` and `POST /api/session/exports/:exportId/rows`.

### GET `/api/jobs/:jobId`

Returns live progress counters and metrics.

### GET `/api/jobs/:jobId/results`

Returns paginated per-item results once the job reaches a terminal status.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `WORKER_COUNT` | `4` | Max concurrent work items |
| `GENESYS_API_CONCURRENCY` | `4` | Max concurrent Genesys HTTP requests |
| `MAX_RETRIES` | `5` | Work-item retry budget |
| `MAX_HTTP_RETRIES` | `5` | HTTP-layer retries for transient errors |
| `RETRY_BASE_DELAY_MS` | `1000` | Backoff base when no `Retry-After` header |
| `JOB_TTL_MS` | `86400000` | Completed job retention in memory |
| `JOB_MAX_ITEMS` | `50000` | Max items per job submission |

## Migrating a bulk action

1. Create `src/lib/jobs/handlers/<action>.js` with:
   - `buildItems(payload)` — expand payload into work items
   - `processItem(item, ctx)` — call `ctx.apiClient` for one unit of work
   - `buildResults(poolResults)` — optional result shaping
2. Register the handler type in `src/lib/jobs/handlers/index.js`
3. Use `GenesysApiClient` exclusively inside handlers (no raw `fetch`)
4. Keep the existing synchronous route until the UI migrates to job submit + poll
5. Add tests with mocked `fetch`

### Example handler shape

```javascript
const buildItems = (payload) =>
  payload.userIds.map((userId) => ({ itemId: userId, payload: { userId } }));

const processItem = async (item, ctx) =>
  ctx.apiClient.patch(`/api/v2/users/${item.itemId}/example`, { ... });

export { buildItems, processItem };
```

## Priority migration candidates

- `getUserSkillMappings` — org-wide read, high item count
- `getUserRoleMappings` — org-wide read
- `movePhonesToSite` — per-phone mutations
- `disconnectConversations` — per-conversation mutations

## AWS migration readiness

Interfaces are designed for future replacement:

| Component | Current | Future |
| --- | --- | --- |
| JobStore | In-memory Map | DynamoDB / SQLite |
| WorkQueue | In-memory array | SQS |
| WorkerPool | In-process | ECS/Lambda workers |

## Current limitations

- Jobs are lost on process restart
- No cross-instance job visibility
- Large result sets remain in memory (paginate via `/results`)
- Cancel/pause is stubbed via `AbortSignal` but not exposed via API yet
- No OAuth refresh-token flow; 401 recovery uses vault re-read when available

## Tests

```bash
node scripts/test-worker-pool.mjs
node scripts/test-genesys-api-client.mjs
node scripts/test-job-manager.mjs
```

Or run the full suite:

```bash
npm test
```
