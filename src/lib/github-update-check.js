import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const packageJsonPath = path.join(projectRoot, "package.json");

const DEFAULT_REPO = "James-Rhodes-G/Genesys_PS_Tool";
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

let releaseCache = { result: null, fetchedAt: 0, error: null };
let lastAlertedLatest = null;

const isUpdateCheckEnabled = () => String(process.env.UPDATE_CHECK_ENABLED ?? "1").trim() !== "0";

const getGithubRepo = () => String(process.env.GITHUB_REPO || DEFAULT_REPO).trim();

const getCacheTtlMs = () => {
  const parsed = Number(process.env.UPDATE_CHECK_CACHE_TTL_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CACHE_TTL_MS;
};

const getIntervalMs = () => {
  const parsed = Number(process.env.UPDATE_CHECK_INTERVAL_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS;
};

const normalizeVersionTag = (tag) => String(tag || "").trim().replace(/^v/i, "");

const parseVersionParts = (version) => {
  const normalized = normalizeVersionTag(version);
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    hasPrerelease: /-/.test(normalized.slice(match[0].length)),
  };
};

/** @returns {-1 | 0 | 1} negative if a < b */
const compareVersions = (a, b) => {
  const left = parseVersionParts(a);
  const right = parseVersionParts(b);
  if (!left || !right) {
    return 0;
  }
  if (left.major !== right.major) {
    return left.major < right.major ? -1 : 1;
  }
  if (left.minor !== right.minor) {
    return left.minor < right.minor ? -1 : 1;
  }
  if (left.patch !== right.patch) {
    return left.patch < right.patch ? -1 : 1;
  }
  if (left.hasPrerelease && !right.hasPrerelease) {
    return -1;
  }
  if (!left.hasPrerelease && right.hasPrerelease) {
    return 1;
  }
  return 0;
};

const isVersionOlder = (current, latest) => compareVersions(current, latest) < 0;

const readServerPackageVersion = () => {
  try {
    const raw = fs.readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw);
    return String(parsed.version || "").trim() || "0.0.0";
  } catch (_error) {
    return "0.0.0";
  }
};

const fetchLatestReleaseFromGithub = async () => {
  const repo = getGithubRepo();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "genesys-ps-tool",
  };
  const token = String(process.env.GITHUB_TOKEN || "").trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}`);
    }
    const payload = await response.json();
    const version = normalizeVersionTag(payload.tag_name);
    if (!version) {
      throw new Error("Release tag missing");
    }
    return {
      version,
      url: String(payload.html_url || "").trim(),
      publishedAt: payload.published_at || null,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const getCachedLatestRelease = async ({ forceRefresh = false } = {}) => {
  if (!isUpdateCheckEnabled()) {
    return { release: null, checkedAt: Date.now(), error: "disabled" };
  }

  const now = Date.now();
  const ttl = getCacheTtlMs();
  if (
    !forceRefresh &&
    releaseCache.result &&
    now - releaseCache.fetchedAt < ttl
  ) {
    return { release: releaseCache.result, checkedAt: releaseCache.fetchedAt, error: null };
  }

  try {
    const release = await fetchLatestReleaseFromGithub();
    releaseCache = { result: release, fetchedAt: now, error: null };
    return { release, checkedAt: now, error: null };
  } catch (error) {
    releaseCache = {
      result: releaseCache.result,
      fetchedAt: releaseCache.fetchedAt,
      error: error.message,
    };
    return {
      release: releaseCache.result,
      checkedAt: releaseCache.fetchedAt || now,
      error: error.message,
    };
  }
};

const buildComponentStatus = (current, latest) => ({
  current: current || null,
  updateAvailable: Boolean(current && latest && isVersionOlder(current, latest)),
});

const getUpdateStatus = async ({ extensionVersion, forceRefresh = false } = {}) => {
  const serverCurrent = readServerPackageVersion();
  const extensionCurrent = extensionVersion ? normalizeVersionTag(extensionVersion) : null;
  const { release, checkedAt, error } = await getCachedLatestRelease({ forceRefresh });
  const latestVersion = release?.version || null;
  const releaseUrl = release?.url || null;

  const server = buildComponentStatus(serverCurrent, latestVersion);
  const extension = buildComponentStatus(extensionCurrent, latestVersion);

  return {
    checkedAt,
    latestVersion,
    releaseUrl,
    updateAvailable: server.updateAvailable || extension.updateAvailable,
    server,
    extension,
    error: error && !release ? error : undefined,
  };
};

const runServerUpdateCheck = async ({ onServerUpdateAvailable, forceRefresh = false } = {}) => {
  if (!isUpdateCheckEnabled()) {
    return;
  }

  const status = await getUpdateStatus({ forceRefresh });
  if (!status.server.updateAvailable || !status.latestVersion) {
    return;
  }

  if (lastAlertedLatest === status.latestVersion) {
    return;
  }
  lastAlertedLatest = status.latestVersion;

  if (typeof onServerUpdateAvailable === "function") {
    onServerUpdateAvailable({
      current: status.server.current,
      latest: status.latestVersion,
      releaseUrl: status.releaseUrl,
    });
  }
};

const startUpdateChecks = ({ onServerUpdateAvailable } = {}) => {
  if (!isUpdateCheckEnabled()) {
    return;
  }

  runServerUpdateCheck({ onServerUpdateAvailable }).catch((error) => {
    console.warn(`Update check failed: ${error.message}`);
  });

  const intervalMs = getIntervalMs();
  setInterval(() => {
    runServerUpdateCheck({ onServerUpdateAvailable, forceRefresh: true }).catch((error) => {
      console.warn(`Update check failed: ${error.message}`);
    });
  }, intervalMs).unref();
};

export {
  compareVersions,
  normalizeVersionTag,
  readServerPackageVersion,
  getUpdateStatus,
  startUpdateChecks,
  isUpdateCheckEnabled,
};
