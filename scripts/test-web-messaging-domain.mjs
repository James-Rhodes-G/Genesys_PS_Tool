import assert from "node:assert/strict";
import {
  buildWebMessagingBaseUrl,
  buildWebMessagingWsUrl,
  getMessagingDomainForRegion,
} from "../src/lib/web-messaging-domain.js";
import {
  classifyGuestFrame,
  extractGuestText,
  mapGuideTurnToEntries,
} from "../public/js/chat-agent-message-parser.js";

assert.equal(getMessagingDomainForRegion("us-east-1"), "mypurecloud.com");
assert.equal(getMessagingDomainForRegion("us-west-2"), "usw2.pure.cloud");
assert.equal(buildWebMessagingBaseUrl("us-east-1"), "https://webmessaging.mypurecloud.com");
assert.match(
  buildWebMessagingWsUrl("us-east-1", "dep-1", "jwt-token"),
  /^wss:\/\/webmessaging\.mypurecloud\.com\/v1\/ws\/deployment\/dep-1\?token=jwt-token$/
);

assert.equal(extractGuestText({ message: { text: "Hello bot" } }), "Hello bot");

const inbound = classifyGuestFrame({ type: "Text", message: { text: "Reply" } }, "inbound");
assert.equal(inbound.category, "inbound");
assert.equal(inbound.label, "Reply");

const typing = classifyGuestFrame({ type: "TypingIndicator" }, "inbound");
assert.equal(typing.category, "raw");

const guideEntries = mapGuideTurnToEntries(
  "outbound",
  { input: { type: "text", text: "Hi" } },
  { output: "Hello there" }
);
assert.equal(guideEntries.length, 2);
assert.equal(guideEntries[1].label, "Hello there");

console.log("test-web-messaging-domain.mjs passed");
