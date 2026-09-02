import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

const getVaultKey = () => {
  const raw = process.env.VAULT_ENCRYPTION_KEY || "";
  const hex = raw.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("VAULT_ENCRYPTION_KEY must be a 32-byte hex string (64 characters).");
  }
  return Buffer.from(hex, "hex");
};

const encryptToken = (plaintext) => {
  const key = getVaultKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
};

const decryptToken = (payload) => {
  const key = getVaultKey();
  const [ivPart, tagPart, dataPart] = String(payload || "").split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Invalid encrypted token payload.");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const encrypted = Buffer.from(dataPart, "base64url");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
};

const hashLinkToken = (linkToken) =>
  crypto.createHash("sha256").update(String(linkToken || ""), "utf8").digest("hex");

const createLinkToken = () => crypto.randomBytes(32).toString("base64url");

const createLaunchCode = () => crypto.randomBytes(16).toString("base64url");

export {
  createLaunchCode,
  createLinkToken,
  decryptToken,
  encryptToken,
  hashLinkToken,
};
