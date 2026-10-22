# PS Tool Backup & Restore Runbook

## Backup schedule

- Automated daily SQLite backups run via the `sqlite_backup` background job.
- Backups are stored in `data/backups/` (or `BACKUP_DIR` if configured).
- Retention defaults to 7 days (`BACKUP_RETENTION_DAYS`).

## What is backed up

By default, daily backups copy:

- `mock-api.db`
- `logs.db`
- `admin.db`

**`session.db` is excluded by default** because it holds customer-heavy data (user cache, export rows, encrypted Genesys tokens). To include it in automated backups, set:

```env
BACKUP_INCLUDE_SESSION_DB=1
```

Use this only when your deployment and data-handling policy explicitly allows retaining that data in backup folders.

## Manual backup

1. Sign in as a **PS Tool operator** (admin login).
2. Open **PS Tool Admin → Server Health**.
3. Click **Run backup now**, or call `POST /api/admin/backups/run` with an operator session cookie.

## Restore procedure

1. **Stop** the PS Tool Node process.
2. **Copy** backup files from `data/backups/<timestamp>/` over the matching files under `data/`:
   - Always restore `mock-api.db`, `admin.db`, and `logs.db` if present in the backup folder.
   - Restore `session.db` only if that file was included in the backup (opt-in) and you intend to recover session/export cache state.
3. **Verify** file permissions and ownership.
4. **Start** the server and confirm `GET /ready` returns 200.
5. **Spot-check** Operations Dashboard and a test org connect (prefer extension launch in production-style configs).

## Quarterly restore test

Perform a restore test in a non-production environment at least quarterly. Document the date and outcome in your ops log.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `BACKUP_DIR` | Override backup destination |
| `BACKUP_RETENTION_DAYS` | Days to keep backup folders |
| `BACKUP_INCLUDE_SESSION_DB` | Set to `1` to include `session.db` in automated backups (default: excluded) |
| `JOB_LEADER` | Set to `0` on secondary nodes to disable scheduled jobs |

See [`docs/security-audit-corporate-policy.md`](../security-audit-corporate-policy.md) for retention and session data policy context.
