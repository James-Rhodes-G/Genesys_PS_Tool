import {
  readControlValue,
  readTopicMultiSelectValues,
  renderGuxFieldText,
  renderGuxTopicMultiSelect,
} from "./gux-ui.js";
import { createNotificationMessageHandler } from "./notification-message-parser.js";
import {
  appendNotificationMessage,
  clearNotificationMessageExport,
  resetNotificationMessageExport,
} from "./notification-message-store.js";
import {
  filterTopicsForGroup,
  getDefaultTopicIds,
  NOTIFICATION_PAGE_GROUPS,
  resolveEntityTopics,
} from "./notification-topics.js";
import { createNotificationSubscriptionManager } from "./notification-subscription.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatStreamEntry = (label, payload) =>
  [`[${new Date().toISOString()}] ${label}`, typeof payload === "string" ? payload : JSON.stringify(payload, null, 2), ""].join(
    "\n"
  );

const createNotificationSubscriptionFeature = ({
  state,
  pageGroup,
  title,
  exportType,
  kind,
  classPrefix,
  panelTitle,
  panelDescription,
  entityField,
  resolveEntity,
  requireCredentialsLabel,
  getAvailableNotificationTopics,
  createNotificationChannel,
  subscribeNotificationTopics,
  deleteNotificationChannel,
  requireCredentials,
  startExportResult,
  finishExportResult,
  rerenderExportSection,
  renderLoadingState,
  openNotificationMessageParser,
  loadingMessage,
}) => {
  const group = NOTIFICATION_PAGE_GROUPS[pageGroup];

  const refreshView = (resultId) => {
    rerenderExportSection(resultId);
  };

  const ensureTopicCatalog = async (exportMeta, credentials) => {
    if (exportMeta.availableTopics?.length) {
      return exportMeta.availableTopics;
    }

    if (!credentials) {
      return [];
    }

    exportMeta.topicsLoading = true;
    exportMeta.topicsError = "";
    refreshView(exportMeta.resultId);

    try {
      const response = await getAvailableNotificationTopics(credentials);
      exportMeta.availableTopics = filterTopicsForGroup(response, pageGroup);
      exportMeta.topicsError = "";
    } catch (error) {
      exportMeta.availableTopics = [];
      exportMeta.topicsError = error.message || "Unable to load available notification topics.";
    } finally {
      exportMeta.topicsLoading = false;
    }

    if (!exportMeta.selectedTopicIds?.length && exportMeta.availableTopics.length) {
      exportMeta.selectedTopicIds = getDefaultTopicIds(pageGroup, { entities: exportMeta.availableTopics });
    }

    return exportMeta.availableTopics;
  };

  const topicRequiresEntity = (topicTemplate) =>
    group.placeholderKeys.some((placeholder) => topicTemplate.includes(placeholder));

  const getSelectedTopicTemplates = (exportMeta) => {
    const selected = new Set(exportMeta.selectedTopicIds || []);
    return (exportMeta.availableTopics || []).filter((topic) => selected.has(topic.id)).map((topic) => topic.id);
  };

  const resolveSelectedTopics = (entityId, selectedTemplates) =>
    selectedTemplates.map((topicTemplate) => {
      if (!topicRequiresEntity(topicTemplate)) {
        return topicTemplate;
      }

      return resolveEntityTopics(entityId, [topicTemplate], {
        defaultTopics: group.defaultTopics,
        placeholderKeys: group.placeholderKeys,
      })[0];
    });

  const renderTopicPicker = (resultId, exportMeta) => {
    if (exportMeta.topicsLoading) {
      return `<div class="field-container">
        <label class="field-label">Subscription Topics</label>
        <p class="muted">Loading available topics…</p>
      </div>`;
    }

    if (exportMeta.topicsError) {
      return `<div class="field-container notification-topic-picker notification-topic-picker--empty">
        <label class="field-label">Subscription Topics</label>
        <p class="muted">${escapeHtml(exportMeta.topicsError)}</p>
      </div>`;
    }

    const selected = new Set(exportMeta.selectedTopicIds || []);
    const topics = (exportMeta.availableTopics || []).map((topic) => ({
      ...topic,
      selected: selected.has(topic.id),
    }));

    return renderGuxTopicMultiSelect({
      escapeHtml,
      className: `${classPrefix}-topics`,
      label: "Subscription Topics",
      topics,
      resultId,
      emptyMessage: `No ${group.label.toLowerCase()} notification topics are currently available from Genesys Cloud.`,
    });
  };

  const appendStreamOutput = (exportMeta, label, payload) => {
    exportMeta.streamOutput = formatStreamEntry(label, payload) + (exportMeta.streamOutput || "");
  };

  const syncParsedMessage = (exportMeta, entry) => {
    appendStreamOutput(exportMeta, entry.label || "WSS Message", entry.data);
    exportMeta.parsedMessages = [entry, ...(exportMeta.parsedMessages || [])];
    appendNotificationMessage(entry, {
      userId: exportMeta.entityId,
      userName: exportMeta.entityName,
    });
  };

  const createSubscriptionManager = (credentials, exportMeta) => {
    exportMeta.messageHandler = createNotificationMessageHandler({
      onParsedMessage: (entry) => {
        syncParsedMessage(exportMeta, entry);
        refreshView(exportMeta.resultId);
      },
      onError: ({ label, payload }) => {
        syncParsedMessage(exportMeta, {
          id: `${Date.now()}-error`,
          timestamp: new Date().toISOString(),
          label: label || "Error",
          category: "error",
          topicName: "",
          data: payload,
        });
        refreshView(exportMeta.resultId);
      },
    });

    return createNotificationSubscriptionManager({
      createChannel: () => createNotificationChannel(credentials),
      subscribeTopics: ({ channelId, topics }) =>
        subscribeNotificationTopics({
          ...credentials,
          channelId,
          topics,
        }),
      deleteChannel: ({ channelId }) =>
        deleteNotificationChannel({
          ...credentials,
          channelId,
        }),
      onStatusChange: (nextStatus) => {
        exportMeta.status = nextStatus.replace(/_/g, " ");
        exportMeta.channelText = exportMeta.subscriptionManager?.getChannelId() || "Not created";
        refreshView(exportMeta.resultId);
      },
      onMessage: async (message) => {
        if (message.type === "notification") {
          await exportMeta.messageHandler.handleNotificationPayload(message.payload);
          return;
        }

        if (message.type === "websocket_closed") {
          syncParsedMessage(exportMeta, {
            id: `${Date.now()}-closed`,
            timestamp: new Date().toISOString(),
            label: "WebSocket Closed",
            category: "system",
            topicName: "",
            data: message.payload,
          });
          refreshView(exportMeta.resultId);
        }
      },
      onError: (error) => {
        exportMeta.status = "error";
        syncParsedMessage(exportMeta, {
          id: `${Date.now()}-subscription-error`,
          timestamp: new Date().toISOString(),
          label: "Subscription Error",
          category: "error",
          topicName: "",
          data: { message: error.message },
        });
        refreshView(exportMeta.resultId);
      },
    });
  };

  const renderSetup = (resultId, exportMeta) => {
    const isListening = exportMeta.subscriptionManager?.getStatus() === "listening";
    const messageCount = (exportMeta.parsedMessages || []).length;

    return `<div class="column-editor user-notifications-panel ${classPrefix}-panel">
      <div class="column-editor__header">${escapeHtml(panelTitle)}</div>
      <p class="muted">${panelDescription}</p>
      <div class="user-notifications-form ${classPrefix}-form">
        ${renderGuxFieldText({
          escapeHtml,
          inputId: `${resultId}-${classPrefix}-entity-id`,
          className: `${classPrefix}-entity-id`,
          label: entityField.label,
          value: exportMeta.entityId || "",
          placeholder: entityField.placeholder,
          attrs: `data-result-id="${escapeHtml(resultId)}"`,
        })}
        ${
          entityField.nameLabel
            ? renderGuxFieldText({
                escapeHtml,
                inputId: `${resultId}-${classPrefix}-entity-name`,
                className: `${classPrefix}-entity-name`,
                label: entityField.nameLabel,
                value: exportMeta.entityName || "",
                placeholder: entityField.namePlaceholder || "Resolved when subscription starts",
                attrs: `readonly data-result-id="${escapeHtml(resultId)}"`,
                clearable: false,
              })
            : ""
        }
        ${renderTopicPicker(resultId, exportMeta)}
        <div class="user-notifications-form__actions ${classPrefix}-form__actions">
          <gux-button class="${classPrefix}-start" type="button" accent="primary" data-result-id="${escapeHtml(
            resultId
          )}"${isListening ? " disabled" : ""}>Start Subscription</gux-button>
          <gux-button class="${classPrefix}-stop" type="button" accent="secondary" data-result-id="${escapeHtml(
            resultId
          )}"${isListening ? "" : " disabled"}>Stop Subscription</gux-button>
          <gux-button class="${classPrefix}-open-parser" type="button" accent="secondary" data-result-id="${escapeHtml(
            resultId
          )}"${isListening || messageCount ? "" : " disabled"}>Open Parsed Messages</gux-button>
          <gux-button class="${classPrefix}-clear" type="button" accent="secondary" data-result-id="${escapeHtml(
            resultId
          )}">Clear Output</gux-button>
        </div>
      </div>
      <div class="user-notifications-status ${classPrefix}-status">
        <div><strong>Status:</strong> <span>${escapeHtml(exportMeta.status || "Idle")}</span></div>
        <div><strong>Channel:</strong> <span>${escapeHtml(exportMeta.channelText || "Not created")}</span></div>
        <div><strong>Messages:</strong> <span>${escapeHtml(String(messageCount))}</span></div>
      </div>
      <div class="user-notifications-output ${classPrefix}-output">
        <h3 class="user-notifications-output__header">WSS Stream Output</h3>
        <textarea id="${escapeHtml(resultId)}-${classPrefix}-stream" class="user-notifications-stream ${classPrefix}-stream" rows="22" readonly>${escapeHtml(
          exportMeta.streamOutput || ""
        )}</textarea>
      </div>
    </div>`;
  };

  const readFormState = (resultId, exportMeta) => {
    const resultEl = document.getElementById(resultId);
    exportMeta.entityId = String(readControlValue(resultEl, `${classPrefix}-entity-id`) || "").trim();
    exportMeta.selectedTopicIds = readTopicMultiSelectValues(resultEl, `${classPrefix}-topics`);
  };

  const startSubscription = async (resultId, exportMeta, credentials) => {
    readFormState(resultId, exportMeta);

    const selectedTemplates = getSelectedTopicTemplates(exportMeta);
    if (!selectedTemplates.length) {
      throw new Error("Select at least one subscription topic.");
    }

    const requiresEntity = selectedTemplates.some((topicTemplate) => topicRequiresEntity(topicTemplate));
    let entityId = "";
    let entityName = "";

    if (requiresEntity) {
      const resolvedEntity = await resolveEntity(credentials, exportMeta.entityId);
      entityId = resolvedEntity.entityId;
      entityName = resolvedEntity.entityName || "";

      if (!entityId) {
        throw new Error(`${entityField.label} is required.`);
      }
    }

    const resolvedTopics = resolveSelectedTopics(entityId, selectedTemplates);

    exportMeta.entityId = entityId;
    exportMeta.entityName = entityName || "";
    exportMeta.parsedMessages = [];
    exportMeta.streamOutput = "";
    exportMeta.messageHandler?.reset?.();
    resetNotificationMessageExport({ userId: entityId, userName: exportMeta.entityName });

    exportMeta.subscriptionManager = createSubscriptionManager(credentials, exportMeta);

    const result = await exportMeta.subscriptionManager.start({
      entityId: entityId || "notifications",
      resolvedTopics,
    });

    exportMeta.channelText = result.channelId;
    exportMeta.status = "listening";
    refreshView(resultId);
  };

  const stopSubscription = async (exportMeta) => {
    if (exportMeta.subscriptionManager) {
      await exportMeta.subscriptionManager.stop();
      exportMeta.subscriptionManager = null;
    }

    exportMeta.messageHandler?.reset?.();
    exportMeta.status = "idle";
    exportMeta.channelText = "Not created";
  };

  const handleClick = async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const startButton = target.closest(`.${classPrefix}-start`);
    if (startButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = startButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return true;
      }

      const credentials = requireCredentials(requireCredentialsLabel || title);
      if (!credentials) {
        return true;
      }

      try {
        await startSubscription(resultId, exportMeta, credentials);
      } catch (error) {
        exportMeta.status = "error";
        refreshView(resultId);
      }

      return true;
    }

    const stopButton = target.closest(`.${classPrefix}-stop`);
    if (stopButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = stopButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return true;
      }

      await stopSubscription(exportMeta);
      refreshView(resultId);
      return true;
    }

    const openParserButton = target.closest(`.${classPrefix}-open-parser`);
    if (openParserButton) {
      event.preventDefault();
      event.stopPropagation();
      openNotificationMessageParser?.();
      return true;
    }

    const clearButton = target.closest(`.${classPrefix}-clear`);
    if (clearButton) {
      event.preventDefault();
      event.stopPropagation();

      const resultId = clearButton.getAttribute("data-result-id");
      const exportMeta = resultId ? state.exportData[resultId] : null;
      if (!resultId || !exportMeta) {
        return true;
      }

      exportMeta.parsedMessages = [];
      exportMeta.streamOutput = "";
      exportMeta.messageHandler?.reset?.();
      clearNotificationMessageExport();
      refreshView(resultId);
      return true;
    }

    return false;
  };

  const handleChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains(`${classPrefix}-topic-option`)) {
      return false;
    }

    const resultId = target.getAttribute("data-result-id");
    const exportMeta = resultId ? state.exportData[resultId] : null;
    if (!resultId || !exportMeta) {
      return false;
    }

    const resultEl = document.getElementById(resultId);
    exportMeta.selectedTopicIds = readTopicMultiSelectValues(resultEl, `${classPrefix}-topics`);
    refreshView(resultId);
    return true;
  };

  const wireButton = (button) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (!state.hasConnection) {
        return;
      }

      const resultId = startExportResult(title, "Configure subscription", renderLoadingState(loadingMessage));

      const exportMeta = {
        resultId,
        title,
        status: "Idle",
        exportType,
        kind,
        hideActions: true,
        editable: false,
        entityId: "",
        entityName: "",
        availableTopics: [],
        selectedTopicIds: [],
        topicsLoading: false,
        topicsError: "",
        channelText: "Not created",
        parsedMessages: [],
        streamOutput: "",
        subscriptionManager: null,
        messageHandler: null,
        renderBody: () => renderSetup(resultId, state.exportData[resultId] || exportMeta),
      };

      state.exportData[resultId] = exportMeta;
      finishExportResult(resultId, exportMeta.title, exportMeta.status, "", exportMeta);

      const credentials = requireCredentials(requireCredentialsLabel || title);
      if (credentials) {
        await ensureTopicCatalog(exportMeta, credentials);
        refreshView(resultId);
      }
    });
  };

  return {
    handleChange,
    handleClick,
    wireButton,
  };
};

export { createNotificationSubscriptionFeature };
