import { getResourceCacheMeta } from "./resource-cache.js";
import { createNotificationEntityPicker } from "./notification-entity-picker.js";
import { createNotificationSubscriptionFeature } from "./notification-subscription-feature.js";

const CLASS_PREFIX = "queue-notifications";

const formatQueueStatus = (status) => {
  const statusBase = `Loaded ${Number.isFinite(status?.count) ? status.count : 0} queue(s)`;
  if (!status?.loaded || !status?.cachedAt) {
    return statusBase;
  }

  return `${statusBase} (cached ${new Date(status.cachedAt).toLocaleString()})`;
};

const createQueueNotificationsFeature = ({ getCachedQueues, getQueues, state, ...deps }) => {
  const entityPicker = createNotificationEntityPicker({
    classPrefix: CLASS_PREFIX,
    state,
    entityIdLabel: "Queue ID",
    entityNameLabel: "Queue Name",
    entityIdPlaceholder: "Enter a queue ID or pick from the list below",
    searchLabel: "Search by queue name or ID",
    searchPlaceholder: "Filter queues",
    itemsKey: "queues",
    formatPrimaryLabel: (queue) => queue?.name || queue?.id || "",
    formatSecondaryLabel: (queue) => queue?.id || "",
  });

  const feature = createNotificationSubscriptionFeature({
    ...deps,
    state,
    pageGroup: "queues",
    title: "Queue Notifications",
    exportType: "queue_notifications",
    kind: "queue-notifications",
    classPrefix: CLASS_PREFIX,
    panelTitle: "Queue Notification Subscription",
    panelDescription:
      'Subscribe to Genesys notification topics for a queue. Enter a queue ID or search by name below. Raw WSS output appears below. Parsed message cards are available under <strong>Parsed Messages</strong>.',
    entityField: {
      label: "Queue ID",
      placeholder: "Required queue ID",
    },
    requireCredentialsLabel: "Queue Notifications",
    loadingMessage: "Preparing queue notification subscription...",
    renderEntityFields: entityPicker.renderEntityFields,
    readEntityFormState: entityPicker.readEntityFormState,
    preparePanelData: async (exportMeta, credentials) => {
      const queues = await getCachedQueues(credentials, getQueues);
      exportMeta.queues = queues
        .slice()
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
      exportMeta.entityFilter = exportMeta.entityFilter || "";
      exportMeta.selectedEntityId = exportMeta.selectedEntityId || "";
      exportMeta.status = formatQueueStatus(getResourceCacheMeta("queues"));
    },
    handleEntityInteraction: entityPicker.handleEntityInteraction,
    resolveEntity: async (_credentials, entityIdInput, exportMeta) => {
      const entityId = String(entityIdInput || "").trim();
      if (!entityId) {
        throw new Error("Queue ID is required.");
      }

      const queue = entityPicker.findEntity(exportMeta, entityId);
      return {
        entityId,
        entityName: entityPicker.formatPrimaryLabel(queue),
      };
    },
  });

  return entityPicker.wrapFeature(feature);
};

export { createQueueNotificationsFeature };
