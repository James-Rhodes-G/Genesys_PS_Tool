import { createNotificationSubscriptionFeature } from "./notification-subscription-feature.js";

const formatUserDisplayName = (user) => {
  if (!user) {
    return "";
  }

  return (
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.userName ||
    user.id ||
    ""
  );
};

const createUserNotificationsFeature = ({ getCurrentUser, getUser, ...deps }) =>
  createNotificationSubscriptionFeature({
    ...deps,
    getCurrentUser,
    getUser,
    pageGroup: "users",
    title: "User Notifications",
    exportType: "user_notifications",
    kind: "user-notifications",
    classPrefix: "user-notifications",
    panelTitle: "User Notification Subscription",
    panelDescription:
      'Subscribe to Genesys notification topics for a user. Raw WSS output appears below. Parsed message cards are available under <strong>Parsed Messages</strong>.',
    entityField: {
      label: "User ID",
      placeholder: "Optional. Leave blank to use /api/v2/users/me",
      nameLabel: "User Name",
      namePlaceholder: "Resolved when subscription starts",
    },
    requireCredentialsLabel: "User Notifications",
    loadingMessage: "Preparing user notification subscription...",
    resolveEntity: async (credentials, entityIdInput) => {
      let entityId = String(entityIdInput || "").trim();
      let userRecord = null;

      if (!entityId) {
        userRecord = await getCurrentUser(credentials);
        entityId = userRecord?.id || "";
      } else {
        userRecord = await getUser({ ...credentials, userId: entityId });
      }

      return {
        entityId,
        entityName: formatUserDisplayName(userRecord),
      };
    },
  });

export { createUserNotificationsFeature, formatUserDisplayName };
