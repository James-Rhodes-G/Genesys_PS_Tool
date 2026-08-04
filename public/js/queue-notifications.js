import { createNotificationSubscriptionFeature } from "./notification-subscription-feature.js";

const createQueueNotificationsFeature = (deps) =>
  createNotificationSubscriptionFeature({
    ...deps,
    pageGroup: "queues",
    title: "Queue Notifications",
    exportType: "queue_notifications",
    kind: "queue-notifications",
    classPrefix: "queue-notifications",
    panelTitle: "Queue Notification Subscription",
    panelDescription:
      'Subscribe to Genesys notification topics for a queue. Raw WSS output appears below. Parsed message cards are available under <strong>Parsed Messages</strong>.',
    entityField: {
      label: "Queue ID",
      placeholder: "Required queue ID",
    },
    requireCredentialsLabel: "Queue Notifications",
    loadingMessage: "Preparing queue notification subscription...",
    resolveEntity: async (_credentials, entityIdInput) => ({
      entityId: String(entityIdInput || "").trim(),
      entityName: "",
    }),
  });

export { createQueueNotificationsFeature };
