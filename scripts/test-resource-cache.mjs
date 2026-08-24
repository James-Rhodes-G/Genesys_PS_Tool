import assert from "node:assert/strict";
import {
  clearResourceCaches,
  clearCachedPhones,
  getCachedPhones,
  getCachedRoles,
  loadCachedResource,
} from "../public/js/resource-cache.js";
import { parseDelimitedIds, isWebRtcPhone, filterPhones, filterUsersWithoutWebRtcPhone, getWebRtcUserIds, getPhonesForSite } from "../public/js/bulk-phone-utils.js";

const calls = [];

const mockLoader = async (credentials) => {
  calls.push(credentials);
  return [{ id: "phone-1", name: "Phone 1" }];
};

clearResourceCaches();
const first = await getCachedPhones({ region: "us-east-1", token: "token" }, mockLoader);
const second = await getCachedPhones({ region: "us-east-1", token: "token" }, mockLoader);

assert.equal(first.length, 1);
assert.equal(second.length, 1);
assert.equal(calls.length, 1, "second request should reuse session cache");

clearResourceCaches();
await getCachedPhones({ region: "us-east-1", token: "token" }, mockLoader);
assert.equal(calls.length, 2, "cache clear should force reload");

await getCachedPhones({ region: "us-east-1", token: "token" }, mockLoader);
assert.equal(calls.length, 2, "phones cache should still be warm");

clearCachedPhones();
await getCachedPhones({ region: "us-east-1", token: "token" }, mockLoader);
assert.equal(calls.length, 3, "clearCachedPhones should force phones reload only");

const roleCalls = [];
const mockRoleLoader = async (credentials) => {
  roleCalls.push(credentials);
  return [{ id: "role-1", name: "Admin" }];
};

clearResourceCaches();
await getCachedRoles({ region: "us-east-1", token: "token" }, mockRoleLoader);
await getCachedRoles({ region: "us-east-1", token: "token" }, mockRoleLoader);
assert.equal(roleCalls.length, 1, "roles cache should reuse session data");

assert.deepEqual(parseDelimitedIds("a\nb, c; d"), ["a", "b", "c", "d"]);
assert.deepEqual(parseDelimitedIds("a, a, b"), ["a", "b"]);

assert.equal(isWebRtcPhone({ webRtcUser: { id: "user-1" } }), true);
assert.equal(isWebRtcPhone({ name: "desk phone" }), false);

assert.deepEqual([...getWebRtcUserIds([
  { id: "phone-1", webRtcUser: { id: "user-1" } },
  { id: "phone-2", name: "desk phone" },
  { id: "phone-3", webRtcUser: { id: "user-2" } },
])].sort(), ["user-1", "user-2"]);

assert.deepEqual(
  filterUsersWithoutWebRtcPhone(
    [
      { id: "user-1", name: "Alice" },
      { id: "user-2", name: "Bob" },
      { id: "user-3", name: "Carol" },
    ],
    [{ id: "phone-1", webRtcUser: { id: "user-2" } }]
  ).map((user) => user.id),
  ["user-1", "user-3"]
);

assert.deepEqual(
  getPhonesForSite(
    [
      { id: "phone-1", name: "WebRTC", site: { id: "site-a" }, webRtcUser: { id: "user-1" } },
      { id: "phone-2", name: "Desk", site: { id: "site-a" } },
      { id: "phone-3", name: "Other", site: { id: "site-b" } },
    ],
    "site-a"
  ).map((phone) => phone.id),
  ["phone-1", "phone-2"]
);

const phones = [
  { id: "1", name: "Alpha", siteName: "Site A" },
  { id: "2", name: "Beta", siteName: "Site B" },
];
assert.equal(filterPhones(phones, "beta").length, 1);

console.log("resource-cache and bulk-phone-utils tests passed");
