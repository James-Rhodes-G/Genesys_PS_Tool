import crypto from "crypto";

const getSessionSecret = () => {
  const fromEnv = String(process.env.SESSION_SECRET || process.env.VAULT_ENCRYPTION_KEY || "").trim();
  if (fromEnv.length >= 32) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET or VAULT_ENCRYPTION_KEY (32+ chars) is required in production.");
  }
  return "dev-insecure-session-secret-change-me";
};

const signSessionPayload = (payload) => {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload, "utf8").digest("base64url");
};

const createSignedSessionId = () => {
  const payload = crypto.randomUUID();
  const signature = signSessionPayload(payload);
  return `${payload}.${signature}`;
};

const parseSignedSessionId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  if (!payload || !signature) {
    return null;
  }
  const expected = signSessionPayload(payload);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  if (!/^[0-9a-f-]{36}$/i.test(payload)) {
    return null;
  }
  return payload;
};

export { createSignedSessionId, parseSignedSessionId, getSessionSecret };
