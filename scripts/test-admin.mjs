import assert from "node:assert/strict";
import {
  initAdminDb,
  insertAdminEvent,
  listAdminEvents,
  insertAdminActivity,
  listAdminActivity,
  getMaintenanceMode,
  setMaintenanceMode,
} from "../src/data/admin-db.js";
import { createAuditService } from "../src/lib/admin-audit.js";
import { isOperator } from "../src/lib/admin-auth.js";
import { classifyRouteFamily } from "../src/lib/core-api-metrics.js";

const adminDb = await initAdminDb();

// Clean test events
await adminDb.run(`DELETE FROM admin_events WHERE action LIKE 'test_%'`);
await adminDb.run(`DELETE FROM admin_activity WHERE action LIKE 'test_%'`);

await insertAdminEvent(adminDb, {
  action: "test_audit_event",
  feature: "test",
  status: "success",
  orgId: "00000000-0000-0000-0000-000000000001",
});

const events = await listAdminEvents(adminDb, { action: "test_audit_event", limit: 10 });
assert.equal(events.length, 1);
assert.equal(events[0].action, "test_audit_event");

await insertAdminActivity(adminDb, {
  sessionId: "test-session",
  action: "test_activity",
  affectedCount: 5,
  successCount: 4,
  failureCount: 1,
});

const activities = await listAdminActivity(adminDb, { sessionId: "test-session" });
assert.equal(activities.length, 1);
assert.equal(activities[0].successCount, 4);

const auditService = createAuditService({
  adminDb,
  insertAdminEvent,
  insertAdminActivity,
});

const mockReq = {
  sessionId: "test-session-2",
  path: "/api/genesys/conversations/bulk-disconnect",
  method: "POST",
  genesysCredentials: { orgId: "org-1", userId: "user-1", userName: "Test User", region: "us-east-1" },
  ip: "127.0.0.1",
  requestId: "req-1",
};

await auditService.recordEvent(mockReq, {
  action: "bulk_disconnect",
  feature: "bulk-actions",
  status: "success",
  itemCount: 10,
  isDangerous: true,
});

const dangerous = await listAdminEvents(adminDb, { dangerousOnly: true, limit: 5 });
assert.ok(dangerous.some((e) => e.action === "bulk_disconnect"));

assert.equal(classifyRouteFamily("POST", "/api/launch/pair"), "POST /api/launch/pair");
assert.equal(classifyRouteFamily("POST", "/api/genesys/users/bulk-logoff"), "POST /api/genesys/users/bulk-logoff");
assert.equal(
  classifyRouteFamily("POST", "/api/genesys/flow-executions/00000000-0000-0000-0000-000000000001/download"),
  "POST /api/genesys/flow-executions/:id/download"
);

const mode = await getMaintenanceMode(adminDb);
assert.ok(["off", "read_only", "drain"].includes(mode.mode));

await setMaintenanceMode(adminDb, { mode: "off", updatedBy: "test" });

const opReq = { get: () => "", genesysCredentials: {} };
assert.equal(isOperator(opReq), true, "admin auth disabled by default allows operator");

console.log("test-admin.mjs: all assertions passed");
