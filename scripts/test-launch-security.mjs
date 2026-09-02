import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  createLaunchCode,
  createLinkToken,
  decryptToken,
  encryptToken,
  hashLinkToken,
} from "../src/lib/credential-vault.js";
import { isLaunchFeature, sanitizeLaunchParams } from "../src/lib/launch-features.js";
import {
  createRateLimiter,
  validateHandoffBody,
  validatePairBody,
  validateUnpairBody,
  verifyLaunchSignature,
} from "../src/lib/launch-validation.js";

process.env.VAULT_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");

const validUuid = "11111111-1111-4111-8111-111111111111";
const validUuid2 = "22222222-2222-4222-8222-222222222222";

const pairBody = await validatePairBody({
  region: "us-east-1",
  token: "test-token",
  orgId: validUuid,
  userId: validUuid2,
});
assert.equal(pairBody.error, undefined);
assert.equal(pairBody.value.region, "us-east-1");

const unknownField = await validatePairBody({
  region: "us-east-1",
  token: "test-token",
  orgId: validUuid,
  userId: validUuid2,
  extra: true,
});
assert.match(unknownField.error, /Unknown field/);

const badRegion = await validatePairBody({
  region: "invalid-region",
  token: "test-token",
  orgId: validUuid,
  userId: validUuid2,
});
assert.match(badRegion.error, /allowlisted/);

const linkToken = createLinkToken();
const handoff = validateHandoffBody({
  linkToken,
  feature: "genesys-users",
  params: { conversationId: "abc-123", ignored: "x" },
});
assert.equal(handoff.error, undefined);
assert.equal(handoff.value.params.conversationId, "abc-123");
assert.equal(handoff.value.params.ignored, undefined);

const badFeature = validateHandoffBody({ linkToken, feature: "not-a-feature" });
assert.match(badFeature.error, /feature is invalid/);

const badLink = validateHandoffBody({ linkToken: "short", feature: "genesys-users" });
assert.match(badLink.error, /linkToken is invalid/);

const unpair = validateUnpairBody({ linkToken });
assert.equal(unpair.error, undefined);

assert.equal(isLaunchFeature("genesys-users"), true);
assert.equal(isLaunchFeature("evil-feature"), false);
assert.deepEqual(sanitizeLaunchParams(null), {});

const encrypted = encryptToken("secret-token");
assert.equal(decryptToken(encrypted), "secret-token");
assert.notEqual(hashLinkToken(linkToken), linkToken);

const launchCode = createLaunchCode();
assert.ok(launchCode.length >= 16);

const originalSecret = process.env.LAUNCH_HMAC_SECRET;
process.env.LAUNCH_HMAC_SECRET = "test-hmac-secret";
const body = { linkToken, feature: "genesys-users", params: {} };
const timestamp = String(Date.now());
const bodyHash = crypto.createHash("sha256").update(JSON.stringify(body), "utf8").digest("hex");
const payload = `${timestamp}:POST:/api/launch/handoff:${bodyHash}`;
const signature = crypto.createHmac("sha256", process.env.LAUNCH_HMAC_SECRET).update(payload, "utf8").digest("hex");

const signedReq = {
  method: "POST",
  path: "/api/launch/handoff",
  get: (header) => {
    if (header === "x-ps-tool-timestamp") return timestamp;
    if (header === "x-ps-tool-signature") return signature;
    return "";
  },
};
assert.equal(verifyLaunchSignature(signedReq, body), true);
assert.equal(
  verifyLaunchSignature(
    {
      method: "POST",
      path: "/api/launch/handoff",
      get: () => "",
    },
    body
  ),
  false
);

process.env.LAUNCH_HMAC_SECRET = "";
assert.equal(verifyLaunchSignature(signedReq, body), true);
process.env.LAUNCH_HMAC_SECRET = originalSecret;

let rateLimited = false;
const limiter = createRateLimiter({
  limit: 2,
  windowMs: 60_000,
  keyFn: () => "test-key",
});
const runLimiter = () =>
  new Promise((resolve) => {
    limiter({ ip: "127.0.0.1" }, { status(code) { this.statusCode = code; return this; }, setHeader() {}, json(payload) { rateLimited = this.statusCode === 429; resolve(payload); } }, resolve);
  });

await runLimiter();
await runLimiter();
await runLimiter();
assert.equal(rateLimited, true);

console.log("test-launch-security.mjs passed");
