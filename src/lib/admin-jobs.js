import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getPlatformSnapshot, getDbSizes, dataDir } from "./platform-metrics.js";

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(dataDir, "backups");
const BACKUP_RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 7);
const DB_FILES = ["session.db", "mock-api.db", "logs.db", "admin.db"];

const runBackup = async ({ insertBackupRun, adminDb }) => {
  const id = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFolder = path.join(BACKUP_DIR, stamp);
    fs.mkdirSync(backupFolder, { recursive: true });

    const files = [];
    let totalBytes = 0;
    for (const file of DB_FILES) {
      const src = path.join(dataDir, file);
      if (!fs.existsSync(src)) continue;
      const dest = path.join(backupFolder, file);
      fs.copyFileSync(src, dest);
      const size = fs.statSync(dest).size;
      files.push({ name: file, size, path: dest });
      totalBytes += size;
    }

    await insertBackupRun(adminDb, {
      id,
      startedAt,
      completedAt: Date.now(),
      status: "success",
      files,
      totalBytes,
    });

    pruneOldBackups();
    return { id, status: "success", totalBytes, files };
  } catch (error) {
    await insertBackupRun(adminDb, {
      id,
      startedAt,
      completedAt: Date.now(),
      status: "failure",
      files: [],
      totalBytes: 0,
      errorMessage: error.message,
    });
    throw error;
  }
};

const pruneOldBackups = () => {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 86400000;
  for (const entry of fs.readdirSync(BACKUP_DIR)) {
    const full = path.join(BACKUP_DIR, entry);
    try {
      const stat = fs.statSync(full);
      if (stat.isDirectory() && stat.mtimeMs < cutoff) {
        fs.rmSync(full, { recursive: true, force: true });
      }
    } catch (_error) {
      // skip
    }
  }
};

const runWithJobLog = async ({ adminDb, insertJobRun, jobName, fn }) => {
  const id = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const rowsAffected = await fn();
    await insertJobRun(adminDb, {
      id,
      jobName,
      startedAt,
      completedAt: Date.now(),
      status: "success",
      durationMs: Date.now() - startedAt,
      rowsAffected: rowsAffected ?? 0,
    });
    return rowsAffected;
  } catch (error) {
    await insertJobRun(adminDb, {
      id,
      jobName,
      startedAt,
      completedAt: Date.now(),
      status: "failure",
      durationMs: Date.now() - startedAt,
      rowsAffected: 0,
      errorMessage: error.message,
    });
    throw error;
  }
};

const createAdminJobs = ({
  adminDb,
  sessionDb,
  mockApiDb,
  insertPresenceSnapshot,
  insertStorageSnapshot,
  insertPlatformSnapshot,
  insertJobRun,
  insertBackupRun,
  listPresenceSnapshots,
  getConnectedUsers,
  purgeExpiredSessionCredentials,
  purgeExpiredData,
  purgeMockApiDeleted,
}) => {
  const takePresenceSnapshot = async () => {
    await purgeExpiredSessionCredentials(sessionDb);
    const users = await getConnectedUsers(sessionDb);
    const snapshotAt = Date.now();
    const uniqueUserIds = new Set(users.map((u) => u.userId).filter(Boolean));
    const uniqueOrgIds = new Set(users.map((u) => u.orgId).filter(Boolean));
    await insertPresenceSnapshot(adminDb, {
      snapshotAt,
      connectedSessions: users.length,
      uniqueUsers: uniqueUserIds.size,
      uniqueOrgs: uniqueOrgIds.size,
      vaultSessions: users.filter((u) => u.authMode === "vault").length,
      oauthSessions: users.filter((u) => u.authMode === "oauth").length,
      manualSessions: users.filter((u) => u.authMode === "manual").length,
    });
    return 1;
  };

  const takeStorageSnapshot = async () => {
    const sizes = getDbSizes();
    await insertStorageSnapshot(adminDb, {
      snapshotAt: Date.now(),
      ...sizes,
      tableStats: {},
    });
    return 1;
  };

  const takePlatformSnapshot = async () => {
    await insertPlatformSnapshot(adminDb, getPlatformSnapshot());
    return 1;
  };

  const runPurgeJob = async () => purgeExpiredData();

  const runBackupJob = async () => {
    await runBackup({ insertBackupRun, adminDb });
    return 1;
  };

  const startJobs = () => {
    const isLeader = process.env.JOB_LEADER !== "0";
    if (!isLeader) return;

    const runJob = (jobName, fn, intervalMs) => {
      const tick = () => {
        runWithJobLog({ adminDb, insertJobRun, jobName, fn }).catch((error) => {
          console.error(`Job ${jobName} failed:`, error.message);
        });
      };
      tick();
      return setInterval(tick, intervalMs).unref();
    };

    runJob("presence_snapshot", takePresenceSnapshot, 5 * 60 * 1000);
    runJob("platform_snapshot", takePlatformSnapshot, 5 * 60 * 1000);
    runJob("storage_snapshot", takeStorageSnapshot, 60 * 60 * 1000);
    runJob("lifecycle_purge", runPurgeJob, 24 * 60 * 60 * 1000);
    runJob("sqlite_backup", runBackupJob, 24 * 60 * 60 * 1000);
    if (purgeMockApiDeleted) {
      runJob("mock_api_purge", purgeMockApiDeleted, 60 * 60 * 1000);
    }
  };

  return {
    startJobs,
    takePresenceSnapshot,
    takeStorageSnapshot,
    takePlatformSnapshot,
    runBackup,
    runWithJobLog,
  };
};

export { createAdminJobs, runBackup, runWithJobLog };
