import { createNotificationEntityPicker } from "./notification-entity-picker.js";
import { createNotificationSubscriptionFeature } from "./notification-subscription-feature.js";

const CLASS_PREFIX = "outbound-notifications";

const createOutboundNotificationsFeature = ({ getCampaigns, state, ...deps }) => {
  const entityPicker = createNotificationEntityPicker({
    classPrefix: CLASS_PREFIX,
    state,
    entityIdLabel: "Campaign ID",
    entityNameLabel: "Campaign Name",
    entityIdPlaceholder: "Enter a campaign ID or pick from the list below",
    searchLabel: "Search by campaign name or ID",
    searchPlaceholder: "Filter campaigns",
    itemsKey: "campaigns",
    formatPrimaryLabel: (campaign) => campaign?.name || campaign?.id || "",
    formatSecondaryLabel: (campaign) => campaign?.id || "",
  });

  const feature = createNotificationSubscriptionFeature({
    ...deps,
    state,
    pageGroup: "outbound",
    title: "Outbound Notifications",
    exportType: "outbound_notifications",
    kind: "outbound-notifications",
    classPrefix: CLASS_PREFIX,
    panelTitle: "Outbound Notification Subscription",
    panelDescription:
      'Subscribe to Genesys outbound notification topics for a campaign. Enter a campaign ID or search by name below. Raw WSS output appears below. Parsed message cards are available under <strong>Parsed Messages</strong>.',
    entityField: {
      label: "Campaign ID",
      placeholder: "Required campaign ID",
    },
    requireCredentialsLabel: "Outbound Notifications",
    loadingMessage: "Preparing outbound notification subscription...",
    renderEntityFields: entityPicker.renderEntityFields,
    readEntityFormState: entityPicker.readEntityFormState,
    preparePanelData: async (exportMeta, credentials) => {
      const campaigns = await getCampaigns(credentials);
      exportMeta.campaigns = campaigns
        .slice()
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
      exportMeta.entityFilter = exportMeta.entityFilter || "";
      exportMeta.selectedEntityId = exportMeta.selectedEntityId || "";
      exportMeta.status = `Loaded ${exportMeta.campaigns.length} campaign(s)`;
    },
    handleEntityInteraction: entityPicker.handleEntityInteraction,
    resolveEntity: async (_credentials, entityIdInput, exportMeta) => {
      const entityId = String(entityIdInput || "").trim();
      if (!entityId) {
        throw new Error("Campaign ID is required.");
      }

      const campaign = entityPicker.findEntity(exportMeta, entityId);
      return {
        entityId,
        entityName: entityPicker.formatPrimaryLabel(campaign),
      };
    },
  });

  return entityPicker.wrapFeature(feature);
};

export { createOutboundNotificationsFeature };
