import crypto from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(crypto.scrypt);

const SCRYPT_KEYLEN = 64;

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(String(password), salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
};

const verifyPassword = async (password, stored) => {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const salt = Buffer.from(parts[1], "base64url");
  const expected = Buffer.from(parts[2], "base64url");
  const derived = await scryptAsync(String(password), salt, SCRYPT_KEYLEN);
  if (expected.length !== derived.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, derived);
};

const createAdminSessionToken = () => crypto.randomBytes(32).toString("base64url");

const hashAdminSessionToken = (token) =>
  crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");

export {
  createAdminSessionToken,
  hashAdminSessionToken,
  hashPassword,
  verifyPassword,
};
