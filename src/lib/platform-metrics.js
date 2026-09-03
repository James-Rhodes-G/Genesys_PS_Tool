import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const dataDir = path.join(projectRoot, "data");
const processStartTime = Date.now();

let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();

const getCpuPercent = () => {
  const now = Date.now();
  const elapsed = now - lastCpuTime;
  if (elapsed < 100) return 0;
  const current = process.cpuUsage(lastCpuUsage);
  lastCpuUsage = process.cpuUsage();
  lastCpuTime = now;
  const totalMicros = (current.user + current.system);
  return Math.min(100, (totalMicros / 1000 / elapsed) * 100);
};

const getDiskFreeBytes = () => {
  try {
    const stats = fs.statfsSync(dataDir);
    return Number(stats.bfree) * Number(stats.bsize);
  } catch (_error) {
    return null;
  }
};

const getPlatformSnapshot = () => {
  const mem = process.memoryUsage();
  return {
    snapshotAt: Date.now(),
    cpuPercent: getCpuPercent(),
    memoryHeapBytes: mem.heapUsed,
    memoryRssBytes: mem.rss,
    diskFreeBytes: getDiskFreeBytes(),
    eventLoopLagMs: null,
  };
};

const getFileSize = (filename) => {
  try {
    return fs.statSync(path.join(dataDir, filename)).size;
  } catch (_error) {
    return 0;
  }
};

const getDbSizes = () => ({
  sessionDbBytes: getFileSize("session.db"),
  mockApiDbBytes: getFileSize("mock-api.db"),
  logsDbBytes: getFileSize("logs.db"),
  adminDbBytes: getFileSize("admin.db"),
});

const getAppInfo = () => ({
  version: process.env.APP_VERSION || "dev",
  gitSha: process.env.GIT_SHA || "unknown",
  environment: process.env.NODE_ENV || "development",
  uptimeSeconds: Math.floor((Date.now() - processStartTime) / 1000),
  hostname: os.hostname(),
});

export { getPlatformSnapshot, getDbSizes, getAppInfo, dataDir, processStartTime };
