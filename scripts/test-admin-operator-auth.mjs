import assert from "node:assert/strict";
import {
  initAdminDb,
  upsertOperator,
  getOperatorByUsername,
  createOperatorSession,
  getOperatorSession,
  deleteOperatorSession,
} from "../src/data/admin-db.js";
import { hashPassword, verifyPassword, hashAdminSessionToken } from "../src/lib/admin-operator-auth.js";
import { isGatedAdminFeatureId } from "../src/lib/admin-feature-ids.js";

const adminDb = await initAdminDb();

const passwordHash = await hashPassword("test-password-123");
await upsertOperator(adminDb, { username: "test-operator", passwordHash });

const operator = await getOperatorByUsername(adminDb, "test-operator");
assert.ok(operator?.id);
assert.equal(await verifyPassword("test-password-123", operator.passwordHash), true);
assert.equal(await verifyPassword("wrong", operator.passwordHash), false);

const tokenHash = hashAdminSessionToken("sample-session-token");
await createOperatorSession(adminDb, {
  tokenHash,
  operatorId: operator.id,
  username: operator.username,
  expiresAt: Date.now() + 60_000,
});

const session = await getOperatorSession(adminDb, tokenHash);
assert.equal(session.username, "test-operator");

await deleteOperatorSession(adminDb, tokenHash);
assert.equal(await getOperatorSession(adminDb, tokenHash), null);

assert.equal(isGatedAdminFeatureId("genesys-admin-operations"), true);
assert.equal(isGatedAdminFeatureId("genesys-mock-api"), false);
assert.equal(isGatedAdminFeatureId("genesys-audit-log-viewer"), false);

console.log("test-admin-operator-auth.mjs: all assertions passed");
