const NOTIFICATION_PAGE_GROUPS = {
  users: {
    id: "users",
    label: "Users",
    prefixes: ["v2.users."],
    excludePatterns: [
      /workforcemanagement/i,
      /\.wem\./i,
      /\.recordings/i,
      /\.export/i,
      /\.jobs/i,
      /coaching/i,
      /learning/i,
      /analytics/i,
      /preview/i,
      /summaries/i,
      /conversationsummary/i,
    ],
    preferredTopics: [
      "v2.users.{id}.conversations",
      "v2.users.{id}.alerting.alerts",
      "v2.users.{id}.presence",
      "v2.users.{id}.routingStatus",
      "v2.users.{id}.station",
      "v2.users.{id}.activity",
      "v2.users.{id}.voicemail.messages",
    ],
    defaultTopics: ["v2.users.{id}.conversations", "v2.users.{id}.alerting.alerts"],
    placeholderKeys: ["{id}", "{userId}"],
  },
  queues: {
    id: "queues",
    label: "Queues",
    prefixes: ["v2.analytics.queues.", "v2.routing.queues.", "v2.taskmanagement.workitems.queues."],
    preferredTopics: [
      "v2.routing.queues.{id}.conversations",
      "v2.analytics.queues.{id}.activity",
      "v2.analytics.queues.{id}.observations",
      "v2.routing.queues.{id}.users",
      "v2.taskmanagement.workitems.queues.{id}",
      "v2.routing.queues.{id}.conversations.callbacks",
      "v2.routing.queues.{id}.conversations.calls",
      "v2.routing.queues.{id}.conversations.chats",
      "v2.routing.queues.{id}.conversations.cobrowseSessions",
      "v2.routing.queues.{id}.conversations.emails",
      "v2.routing.queues.{id}.conversations.messages",
      "v2.routing.queues.{id}.conversations.screenshares",
      "v2.routing.queues.{id}.conversations.socialexpressions",
      "v2.routing.queues.{id}.conversations.videos",
    ],
    defaultTopics: ["v2.routing.queues.{id}.conversations", "v2.analytics.queues.{id}.activity"],
    placeholderKeys: ["{id}", "{queueId}"],
  },
  outbound: {
    id: "outbound",
    label: "Outbound",
    prefixes: ["v2.outbound."],
    preferredTopics: [
      "v2.outbound.campaigns.{id}.progress",
      "v2.outbound.campaigns.{id}.stats",
      "v2.outbound.campaigns.{id}",
      "v2.outbound.campaignrules.{id}",
      "v2.outbound.schedules.campaigns.{id}",
      "v2.outbound.sequences.{id}",
      "v2.outbound.messagingcampaigns.{id}",
      "v2.outbound.messagingcampaigns.{id}.progress",
      "v2.outbound.emailcampaigns.{id}",
      "v2.outbound.emailcampaigns.{id}.progress",
      "v2.outbound.whatsappcampaigns.{id}",
      "v2.outbound.whatsappcampaigns.{id}.progress",
      "v2.outbound.contactlists.{id}.importstatus",
      "v2.outbound.dnclists.{id}.importstatus",
      "v2.outbound.importtemplates.{id}.importstatus",
      "v2.outbound.settings",
    ],
    defaultTopics: ["v2.outbound.campaigns.{id}.progress", "v2.outbound.campaigns.{id}.stats"],
    placeholderKeys: ["{id}", "{campaignId}"],
  },
};

const normalizeAvailableTopics = (payload) => {
  const entities = Array.isArray(payload?.entities)
    ? payload.entities
    : Array.isArray(payload)
      ? payload
      : [];

  return entities
    .map((entry) => ({
      id: String(entry?.id || "").trim(),
      description: String(entry?.description || entry?.name || "").trim(),
    }))
    .filter((entry) => entry.id);
};

const topicMatchesGroup = (topicId, group) => {
  if (!group?.prefixes?.some((prefix) => topicId.startsWith(prefix))) {
    return false;
  }

  return !(group.excludePatterns || []).some((pattern) => pattern.test(topicId));
};

const filterTopicsForGroup = (availableTopics, groupKey) => {
  const group = NOTIFICATION_PAGE_GROUPS[groupKey];
  if (!group) {
    return [];
  }

  const normalized = normalizeAvailableTopics(availableTopics);
  const matching = normalized.filter((topic) => topicMatchesGroup(topic.id, group));
  const preferredSet = new Set(group.preferredTopics);

  const preferred = group.preferredTopics
    .map((topicId) => matching.find((topic) => topic.id === topicId))
    .filter(Boolean);

  const rest = matching
    .filter((topic) => !preferredSet.has(topic.id))
    .sort((left, right) => left.id.localeCompare(right.id));

  return [...preferred, ...rest];
};

const getDefaultTopicIds = (groupKey, availableTopics) => {
  const group = NOTIFICATION_PAGE_GROUPS[groupKey];
  if (!group) {
    return [];
  }

  const filtered = filterTopicsForGroup(availableTopics, groupKey);
  const availableIds = new Set(filtered.map((topic) => topic.id));

  return group.defaultTopics.filter((topicId) => availableIds.has(topicId));
};

const resolveEntityTopics = (entityId, topicTemplates, { defaultTopics = [], placeholderKeys = ["{id}"] } = {}) => {
  const normalizedEntityId = String(entityId || "").trim();
  if (!normalizedEntityId) {
    throw new Error("Entity ID is required.");
  }

  const templates = (Array.isArray(topicTemplates) && topicTemplates.length ? topicTemplates : defaultTopics).map((topic) =>
    String(topic || "").trim()
  ).filter(Boolean);

  if (!templates.length) {
    throw new Error("At least one subscription topic is required.");
  }

  return templates.map((topic) =>
    placeholderKeys.reduce((resolvedTopic, placeholder) => {
      const pattern = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      return resolvedTopic.replace(pattern, normalizedEntityId);
    }, topic)
  );
};

export {
  NOTIFICATION_PAGE_GROUPS,
  filterTopicsForGroup,
  getDefaultTopicIds,
  normalizeAvailableTopics,
  resolveEntityTopics,
  topicMatchesGroup,
};
