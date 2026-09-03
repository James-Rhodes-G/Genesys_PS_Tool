# PS Tool Backup & Restore Runbook

## Backup schedule

- Automated daily SQLite backups run via the `sqlite_backup` background job.
- Backups are stored in `data/backups/` (or `BACKUP_DIR` if configured).
- Retention defaults to 7 days (`BACKUP_RETENTION_DAYS`).

## Manual backup

1. Open **PS Tool Admin → Server Health**.
2. Click **Run backup now**, or call `POST /api/admin/backups/run` as an operator.

## Restore procedure

1. **Stop** the PS Tool Node process.
2. **Copy** backup files from `data/backups/<timestamp>/` over `data/session.db`, `data/mock-api.db`, `data/admin.db`, and `data/logs.db` as needed.
3. **Verify** file permissions and ownership.
4. **Start** the server and confirm `GET /ready` returns 200.
5. **Spot-check** Operations Dashboard and a test org connect.

## Quarterly restore test

Perform a restore test in a non-production environment at least quarterly. Document the date and outcome in your ops log.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `BACKUP_DIR` | Override backup destination |
| `BACKUP_RETENTION_DAYS` | Days to keep backup folders |
| `JOB_LEADER` | Set to `0` on secondary nodes to disable scheduled jobs |
