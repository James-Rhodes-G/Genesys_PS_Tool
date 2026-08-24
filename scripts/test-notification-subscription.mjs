import assert from "node:assert/strict";
import {
  formatSubscriptionTopicFailure,
  summarizeSubscriptionFailures,
} from "../public/js/notification-subscription.js";
import { subscribeNotificationTopicsWithResults } from "../src/lib/genesys.js";

assert.equal(
  formatSubscriptionTopicFailure({
    topic: "v2.users.user-1.routingStatus",
    status: 403,
    message: "Forbidden",
  }),
  "v2.users.user-1.routingStatus (403): Forbidden"
);

const partialSummary = summarizeSubscriptionFailures([
  {
    topic: "v2.users.user-1.conversations",
    status: 403,
    message: "Forbidden",
  },
]);

assert.match(partialSummary, /Some topics could not be subscribed/);
assert.match(partialSummary, /v2.users.user-1.conversations \(403\): Forbidden/);
assert.match(partialSummary, /HTTP 403 usually means/);

const totalFailureSummary = summarizeSubscriptionFailures(
  [
    {
      topic: "v2.users.user-1.routingStatus",
      status: 403,
      message: "Forbidden",
    },
  ],
  { allTopicsFailed: true }
);

assert.match(totalFailureSummary, /Unable to subscribe to any selected topics/);

const genesysCalls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  genesysCalls.push({ url: String(url), body: options.body });

  const topicId = JSON.parse(String(options.body || "[]"))[0]?.id;
  if (topicId === "v2.users.user-1.conversations") {
    return new Response(JSON.stringify({ message: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ entities: [{ id: topicId }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

try {
  const results = await subscribeNotificationTopicsWithResults({
    region: "us-east-1",
    token: "token",
    channelId: "channel-1",
    topics: ["v2.users.user-1.conversations", "v2.users.user-1.routingStatus"],
  });

  assert.deepEqual(results.succeeded, ["v2.users.user-1.routingStatus"]);
  assert.equal(results.failed.length, 1);
  assert.equal(results.failed[0].status, 403);
  assert.equal(genesysCalls.length, 2);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("notification-subscription validation passed");
