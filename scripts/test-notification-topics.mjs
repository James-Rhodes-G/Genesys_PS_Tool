import {
  filterTopicsForGroup,
  getDefaultTopicIds,
  normalizeAvailableTopics,
  resolveEntityTopics,
} from "../public/js/notification-topics.js";

const sampleAvailableTopics = {
  entities: [
    { id: "v2.users.{id}.conversations", description: "User conversations" },
    { id: "v2.users.{id}.alerting.alerts", description: "User alerts" },
    { id: "v2.users.{id}.presence", description: "User presence" },
    { id: "v2.users.{id}.workforcemanagement.schedules", description: "WFM schedules" },
    { id: "v2.routing.queues.{id}.conversations", description: "Queue conversations" },
    { id: "v2.analytics.queues.{id}.activity", description: "Queue activity" },
    { id: "v2.outbound.campaigns.{id}.progress", description: "Campaign progress" },
    { id: "v2.outbound.campaigns.{id}.stats", description: "Campaign stats" },
    { id: "v2.outbound.settings", description: "Outbound settings" },
  ],
};

const normalized = normalizeAvailableTopics(sampleAvailableTopics);
if (normalized.length !== 9) {
  throw new Error(`Expected 9 normalized topics, received ${normalized.length}.`);
}

const userTopics = filterTopicsForGroup(sampleAvailableTopics, "users");
if (!userTopics.some((topic) => topic.id === "v2.users.{id}.conversations")) {
  throw new Error("Expected user conversations topic in the users group.");
}
if (userTopics.some((topic) => topic.id.includes("workforcemanagement"))) {
  throw new Error("Expected WFM topics to be excluded from the users group.");
}

const userDefaults = getDefaultTopicIds("users", sampleAvailableTopics);
if (userDefaults.join(",") !== "v2.users.{id}.conversations,v2.users.{id}.alerting.alerts") {
  throw new Error(`Unexpected user defaults: ${userDefaults.join(", ")}`);
}

const queueDefaults = getDefaultTopicIds("queues", sampleAvailableTopics);
if (queueDefaults.join(",") !== "v2.routing.queues.{id}.conversations,v2.analytics.queues.{id}.activity") {
  throw new Error(`Unexpected queue defaults: ${queueDefaults.join(", ")}`);
}

const outboundDefaults = getDefaultTopicIds("outbound", sampleAvailableTopics);
if (outboundDefaults.join(",") !== "v2.outbound.campaigns.{id}.progress,v2.outbound.campaigns.{id}.stats") {
  throw new Error(`Unexpected outbound defaults: ${outboundDefaults.join(", ")}`);
}

const resolved = resolveEntityTopics(
  "abc-123",
  ["v2.users.{id}.conversations", "v2.users.{userId}.alerting.alerts"],
  {
    defaultTopics: ["v2.users.{id}.conversations"],
    placeholderKeys: ["{id}", "{userId}"],
  }
);

if (resolved.join(",") !== "v2.users.abc-123.conversations,v2.users.abc-123.alerting.alerts") {
  throw new Error(`Unexpected resolved topics: ${resolved.join(", ")}`);
}

const emptyGroup = filterTopicsForGroup({ entities: [] }, "queues");
if (emptyGroup.length !== 0) {
  throw new Error("Expected empty queue topic list when API returns no matches.");
}

console.log("notification-topics validation passed");
