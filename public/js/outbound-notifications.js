import { createNotificationSubscriptionFeature } from "./notification-subscription-feature.js";

const createOutboundNotificationsFeature = (deps) =>
  createNotificationSubscriptionFeature({
    ...deps,
    pageGroup: "outbound",
    title: "Outbound Notifications",
    exportType: "outbound_notifications",
    kind: "outbound-notifications",
    classPrefix: "outbound-notifications",
    panelTitle: "Outbound Notification Subscription",
    panelDescription:
      'Subscribe to Genesys outbound notification topics for a campaign or outbound entity. Raw WSS output appears below. Parsed message cards are available under <strong>Parsed Messages</strong>.',
    entityField: {
      label: "Campaign ID",
      placeholder: "Required campaign ID",
    },
    requireCredentialsLabel: "Outbound Notifications",
    loadingMessage: "Preparing outbound notification subscription...",
    resolveEntity: async (_credentials, entityIdInput) => ({
      entityId: String(entityIdInput || "").trim(),
      entityName: "",
    }),
  });

export { createOutboundNotificationsFeature };
