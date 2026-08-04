import { renderJsonTree } from "./json-tree.js";
import { formatParserTimestamp, getNotificationMessageLabel } from "./notification-message-parser.js";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const extractJsonType = (data) => {
  if (!data || typeof data !== "object") {
    return null;
  }

  if (typeof data.type === "string" && data.type) {
    return data.type;
  }

  if (data.eventBody && typeof data.eventBody === "object" && typeof data.eventBody.type === "string" && data.eventBody.type) {
    return data.eventBody.type;
  }

  if (typeof data.data === "string") {
    try {
      const inner = JSON.parse(data.data);
      if (inner && typeof inner.type === "string" && inner.type) {
        return inner.type;
      }
    } catch {
      return null;
    }
  }

  return null;
};

const getMessageLabel = (message) => {
  const type = extractJsonType(message?.data);
  if (type) {
    return type;
  }

  return message?.label || getNotificationMessageLabel(message?.data) || "Message";
};

const inferBadge = (message) => {
  if (message?.category) {
    return message.category;
  }

  if (message?.data && typeof message.data === "object" && message.data.type) {
    return String(message.data.type);
  }

  return "notification";
};

const isRawMessage = (message) => message?.category === "raw";

const getVisibleMessages = (messages, hideRawMessages) => {
  if (!hideRawMessages) {
    return messages;
  }

  return messages.filter((message) => !isRawMessage(message));
};

const renderMessageCard = (message, index, options = {}) => {
  const card = document.createElement("details");
  card.className = "message-card";
  card.open = options.openAll === true || (options.openAll !== false && index < (options.openFirst ?? 3));

  const summary = document.createElement("summary");
  summary.innerHTML =
    `<span class="message-card__index">#${escapeHtml(String(index + 1))}</span>` +
    `<span class="message-card__time">${escapeHtml(formatParserTimestamp(message.timestamp))}</span>` +
    `<span class="message-card__label">${escapeHtml(getMessageLabel(message))}</span>` +
    `<span class="message-card__badge">${escapeHtml(inferBadge(message))}</span>` +
    (message.topicName || message.origin
      ? `<span class="message-card__origin">${escapeHtml(message.topicName || message.origin)}</span>`
      : "");

  const body = document.createElement("div");
  body.className = "message-card__body";

  const payloadSection = document.createElement("div");
  payloadSection.className = "message-card__section";

  const payloadTitle = document.createElement("h4");
  payloadTitle.className = "message-card__section-title";
  payloadTitle.textContent = "Payload";
  payloadSection.appendChild(payloadTitle);
  payloadSection.appendChild(renderJsonTree(message.data, { expand: options.expandJson !== false }));

  body.appendChild(payloadSection);
  card.appendChild(summary);
  card.appendChild(body);

  return card;
};

const renderMessageList = (container, messages, options = {}) => {
  if (!container) {
    return;
  }

  const visibleMessages = getVisibleMessages(Array.isArray(messages) ? messages : [], options.hideRawMessages !== false);

  container.innerHTML = "";

  if (!visibleMessages.length) {
    const empty = document.createElement("p");
    empty.className = "message-list__empty muted";
    empty.textContent = options.emptyText || "No messages yet.";
    container.appendChild(empty);
    return;
  }

  visibleMessages.forEach((message, index) => {
    container.appendChild(renderMessageCard(message, index, options));
  });
};

export {
  escapeHtml,
  getMessageLabel,
  getVisibleMessages,
  inferBadge,
  isRawMessage,
  renderMessageCard,
  renderMessageList,
};
