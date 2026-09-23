import assert from "node:assert/strict";
import {
  buildHealthCheckReport,
  computeHealthChecks,
} from "../public/js/dashboard/health-check-reports.js";

const users = [
  { id: "u1", name: "Alice", authorization: { roles: [] }, skills: [] },
  { id: "u2", name: "Bob", authorization: { roles: [{ name: "Agent" }] }, skills: [{ id: "s1" }] },
  { id: "u3", name: "Carol", authorization: { roles: [{ name: "Supervisor" }] }, skills: [] },
];

const phones = [
  { id: "p1", name: "Alice Phone", webRtcUser: { id: "u2" } },
  { id: "p2", name: "orphan_webRTC", webRtcUser: null },
];

const queues = [
  { id: "q1", name: "Support" },
  { id: "q2", name: "Sales" },
];

const queueMembersById = {
  q1: [{ id: "m1" }],
  q2: [],
};

const checks = computeHealthChecks({ users, phones, queues, queueMembersById });
const checkById = Object.fromEntries(checks.map((check) => [check.id, check]));

assert.equal(checkById["users-without-roles"].count, 1);
assert.equal(checkById["users-without-skills"].count, 2);
assert.equal(checkById["users-without-phones"].count, 2);
assert.equal(checkById["webrtc-without-user"].count, 1);
assert.equal(checkById["queues-without-members"].count, 1);

const pendingQueueChecks = computeHealthChecks({ users, phones, queues, queueMembersById: null });
const pendingQueueCheck = pendingQueueChecks.find((check) => check.id === "queues-without-members");
assert.equal(pendingQueueCheck.count, null);
assert.equal(pendingQueueCheck.needsQueueMembers, true);

const rolesReport = buildHealthCheckReport(
  "users-without-roles",
  { users, phones, queues, queueMembersById },
  "report-1"
);
assert.equal(rolesReport.rows.length, 1);
assert.equal(rolesReport.rows[0].name, "Alice");
assert.equal(rolesReport.exportMeta.selectedColumnKeys.includes("userId"), true);

const emptyQueuesReport = buildHealthCheckReport(
  "queues-without-members",
  { users, phones, queues, queueMembersById },
  "report-2"
);
assert.equal(emptyQueuesReport.rows.length, 1);
assert.equal(emptyQueuesReport.rows[0].queueName, "Sales");

console.log("health check report tests passed");
