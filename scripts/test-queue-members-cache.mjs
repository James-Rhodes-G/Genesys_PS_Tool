import assert from "node:assert/strict";
import {
  clearQueueMembersCache,
  loadAllQueueMembers,
  peekQueueMembersById,
} from "../public/js/dashboard/queue-members-cache.js";
import { clearResourceCaches, loadCachedResource } from "../public/js/resource-cache.js";

const queues = [{ id: "q1", name: "Support" }, { id: "q2", name: "Sales" }];
let requestCount = 0;

const deps = {
  getQueueMembers: async ({ queueId }) => {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));
    return queueId === "q1" ? [{ id: "m1" }] : [];
  },
};

clearResourceCaches();
await loadCachedResource("queues", {}, async () => queues);
clearQueueMembersCache();

const firstLoad = loadAllQueueMembers(deps, { region: "us-east-1", token: "token" });
const secondLoad = loadAllQueueMembers(deps, { region: "us-east-1", token: "token" });
const [first, second] = await Promise.all([firstLoad, secondLoad]);

assert.equal(first, second);
assert.equal(requestCount, 2);
assert.deepEqual(peekQueueMembersById(), { q1: [{ id: "m1" }], q2: [] });

clearQueueMembersCache();
clearResourceCaches();
assert.equal(peekQueueMembersById(), null);

console.log("queue members cache tests passed");
