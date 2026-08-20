import assert from "node:assert/strict";
import { buildPhoneSiteMoveBody } from "../src/lib/genesys.js";
import { formatBulkProgressGuidance, formatPhoneMoveProgressGuidance } from "../public/js/bulk-phone-utils.js";

const sampleWebRtcPhone = {
  id: "phone-1",
  name: "jdoe_webRTC",
  site: { id: "site-old", name: "Old Site" },
  phoneBaseSettings: { id: "pbs-1", name: "WebRTC Settings" },
  webRtcUser: { id: "user-1", name: "John Doe", selfUri: "/users/user-1" },
  lines: [
    {
      id: "line-1",
      name: "Line 1",
      site: { id: "site-old" },
      template: { id: "template-1" },
      lineBaseSettings: { id: "lbs-1", name: "Line Settings" },
      loggedInUser: { id: "user-1" },
    },
  ],
};

const body = buildPhoneSiteMoveBody(sampleWebRtcPhone, {
  siteId: "site-new",
  siteName: "New Site",
});

assert.deepEqual(body, {
  name: "jdoe_webRTC",
  site: { id: "site-new", name: "New Site" },
  phoneBaseSettings: { id: "pbs-1" },
  webRtcUser: { id: "user-1" },
  lines: [
    {
      id: "line-1",
      name: "Line 1",
      lineBaseSettings: { id: "lbs-1" },
    },
  ],
});

assert.equal("template" in body.lines[0], false);
assert.equal("site" in body.lines[0], false);
assert.equal("loggedInUser" in body, false);
assert.equal("selfUri" in body.webRtcUser, false);

assert.equal(
  formatPhoneMoveProgressGuidance({ completed: 25, total: 100, successCount: 24, failedCount: 1 }),
  "25 / 100 phones (25%) — 24 succeeded, 1 failed"
);

assert.equal(
  formatBulkProgressGuidance({ completed: 3, total: 10, successCount: 2, failedCount: 1, unitLabel: "users" }),
  "3 / 10 users (30%) — 2 succeeded, 1 failed"
);

console.log("phone site move tests passed");
