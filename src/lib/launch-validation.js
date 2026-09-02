import crypto from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { isLaunchFeature, sanitizeLaunchParams } from "./launch-features.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LINK_TOKEN_RE = /^[A-Za-z0-9_-]{43,128}$/;

let regionIdsPromise;

const loadRegionIds = async () => {
  if (!regionIdsPromise) {
    regionIdsPromise = readFile(path.join(projectRoot, "public", "data", "genesys_regions.json"), "utf8")
      .then((raw) => JSON.parse(raw))
      .then((rows) => new Set(rows.map((entry) => entry.id)));
  }
  return regionIdsPromise;
};

const isUuid = (value) => UUID_RE.test(String(value || "").trim());

const rejectUnknownKeys = (body, allowedKeys) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be a JSON object.";
  }

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      return `Unknown field: ${key}`;
    }
  }

  return "";
};

const validatePairBody = async (body) => {
  const allowed = new Set(["region", "token", "orgId", "userId"]);
  const unknown = rejectUnknownKeys(body, allowed);
  if (unknown) {
    return { error: unknown };
  }

  const region = String(body.region || "").trim();
  const token = String(body.token || "").trim();
  const orgId = String(body.orgId || "").trim();
  const userId = String(body.userId || "").trim();

  if (!region || region.length > 128) {
    return { error: "region is required." };
  }
  if (!token || token.length > 8192) {
    return { error: "token is required." };
  }
  if (!isUuid(orgId)) {
    return { error: "orgId must be a UUID." };
  }
  if (!isUuid(userId)) {
    return { error: "userId must be a UUID." };
  }

  const regionIds = await loadRegionIds();
  if (!regionIds.has(region)) {
    return { error: "region is not allowlisted." };
  }

  return { value: { region, token, orgId, userId } };
};

const validateHandoffBody = (body) => {
  const allowed = new Set(["linkToken", "feature", "params"]);
  const unknown = rejectUnknownKeys(body, allowed);
  if (unknown) {
    return { error: unknown };
  }

  const linkToken = String(body.linkToken || "").trim();
  const feature = String(body.feature || "").trim();

  if (!linkToken || !LINK_TOKEN_RE.test(linkToken)) {
    return { error: "linkToken is invalid." };
  }
  if (!feature || !isLaunchFeature(feature)) {
    return { error: "feature is invalid." };
  }

  return {
    value: {
      linkToken,
      feature,
      params: sanitizeLaunchParams(body.params),
    },
  };
};

const validateUnpairBody = (body) => {
  const allowed = new Set(["linkToken"]);
  const unknown = rejectUnknownKeys(body, allowed);
  if (unknown) {
    return { error: unknown };
  }

  const linkToken = String(body.linkToken || "").trim();
  if (!linkToken || !LINK_TOKEN_RE.test(linkToken)) {
    return { error: "linkToken is invalid." };
  }

  return { value: { linkToken } };
};

const hashBody = (body) =>
  crypto.createHash("sha256").update(JSON.stringify(body ?? {}), "utf8").digest("hex");

const verifyLaunchSignature = (req, body) => {
  const secret = process.env.LAUNCH_HMAC_SECRET || "";
  if (!secret) {
    return true;
  }

  const timestamp = String(req.get("x-ps-tool-timestamp") || "").trim();
  const signature = String(req.get("x-ps-tool-signature") || "").trim();
  if (!timestamp || !signature) {
    return false;
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return false;
  }

  const skewMs = Math.abs(Date.now() - ts);
  if (skewMs > 5 * 60 * 1000) {
    return false;
  }

  const payload = `${timestamp}:${req.method}:${req.path}:${hashBody(body)}`;
  const expected = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
};

const createRateLimiter = ({ limit, windowMs, keyFn }) => {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn(req);
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (now >= bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > limit) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: "Too many requests." });
      return;
    }

    next();
  };
};

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export {
  createRateLimiter,
  escapeHtml,
  validateHandoffBody,
  validatePairBody,
  validateUnpairBody,
  verifyLaunchSignature,
};
