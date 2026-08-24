import { appendUserCacheStatus, loadSessionUsers } from "./session-store.js";
import { createNotificationEntityPicker, filterNamedEntities } from "./notification-entity-picker.js";
import { createNotificationSubscriptionFeature } from "./notification-subscription-feature.js";

const CLASS_PREFIX = "user-notifications";

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

const formatUserUsername = (user) => user?.userName || user?.username || user?.id || "";

const createUserNotificationsFeature = ({
  getCurrentUser,
  getUser,
  loadSessionUsers: loadUsers = loadSessionUsers,
  state,
  ...deps
}) => {
  const entityPicker = createNotificationEntityPicker({
    classPrefix: CLASS_PREFIX,
    state,
    entityIdLabel: "User ID",
    entityNameLabel: "User Name",
    entityIdPlaceholder: "Optional. Leave blank for Me, enter an ID, or pick from the list below",
    searchLabel: "Search by name or username",
    searchPlaceholder: "Filter users",
    itemsKey: "users",
    formatPrimaryLabel: formatUserDisplayName,
    formatSecondaryLabel: formatUserUsername,
    filterItems: (items, filterText) => filterNamedEntities(items, filterText, ["userName", "username"]),
    meAction: {
      buttonLabel: "Me",
      hintHtml: 'Subscribe as the connected user (<code>/api/v2/users/me</code>)',
      onSelectMe(exportMeta) {
        exportMeta.entityId = "";
        exportMeta.selectedEntityId = "";
        exportMeta.entityName = exportMeta.connectedUserName || "";
      },
    },
  });

  const feature = createNotificationSubscriptionFeature({
    ...deps,
    state,
    getCurrentUser,
    getUser,
    pageGroup: "users",
    title: "User Notifications",
    exportType: "user_notifications",
    kind: "user-notifications",
    classPrefix: CLASS_PREFIX,
    panelTitle: "User Notification Subscription",
    panelDescription:
      'Subscribe to Genesys notification topics for a user. Leave User ID blank or click <strong>Me</strong> for the connected user, enter an ID directly, or search by name or username below. Raw WSS output appears below. Parsed message cards are available under <strong>Parsed Messages</strong>.',
    entityField: {
      label: "User ID",
      placeholder: "Optional. Leave blank to use /api/v2/users/me",
      nameLabel: "User Name",
      namePlaceholder: "Resolved when subscription starts",
    },
    requireCredentialsLabel: "User Notifications",
    loadingMessage: "Preparing user notification subscription...",
    renderEntityFields: entityPicker.renderEntityFields,
    readEntityFormState: entityPicker.readEntityFormState,
    preparePanelData: async (exportMeta, credentials) => {
      const [{ users, cache: userCache }, currentUser] = await Promise.all([
        loadUsers(credentials),
        getCurrentUser(credentials),
      ]);

      exportMeta.users = users
        .slice()
        .sort((left, right) =>
          String(formatUserDisplayName(left)).localeCompare(String(formatUserDisplayName(right)))
        );
      exportMeta.userCache = userCache;
      exportMeta.connectedUserId = currentUser?.id || "";
      exportMeta.connectedUserName = formatUserDisplayName(currentUser);
      exportMeta.connectedUserUsername = formatUserUsername(currentUser);
      exportMeta.entityFilter = exportMeta.entityFilter || "";
      exportMeta.selectedEntityId = exportMeta.selectedEntityId || "";
      exportMeta.entityName = exportMeta.entityName || exportMeta.connectedUserName || "";

      const userCount = exportMeta.users.length;
      const statusBase = `Loaded ${userCount} user(s)`;
      exportMeta.status = appendUserCacheStatus(statusBase, userCache);
    },
    handleEntityInteraction: entityPicker.handleEntityInteraction,
    resolveEntity: async (credentials, entityIdInput, exportMeta) => {
      let entityId = String(entityIdInput || "").trim();
      let userRecord = null;

      if (!entityId) {
        userRecord = await getCurrentUser(credentials);
        entityId = userRecord?.id || "";
      } else {
        userRecord =
          entityPicker.findEntity(exportMeta, entityId) ||
          (await getUser({ ...credentials, userId: entityId }));
      }

      return {
        entityId,
        entityName: formatUserDisplayName(userRecord),
      };
    },
  });

  return entityPicker.wrapFeature(feature);
};

export { createUserNotificationsFeature, formatUserDisplayName };
