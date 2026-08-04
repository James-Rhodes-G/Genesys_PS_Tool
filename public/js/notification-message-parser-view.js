import { setAllJsonTreeExpanded } from "./json-tree.js";
import { getVisibleMessages, renderMessageList } from "./message-cards.js";
import {
  clearNotificationMessageExport,
  loadNotificationMessageExport,
  STORAGE_KEY,
  subscribeNotificationMessageExport,
} from "./notification-message-store.js";
import { formatParserTimestamp } from "./notification-message-parser.js";

const HIDE_RAW_KEY = "ps_tool_notification_parser_hide_raw";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildElementId = (resultId, name) => (resultId ? `${resultId}-${name}` : name);

const renderNotificationMessageParserPanel = ({ resultId = "" } = {}) => {
  const id = (name) => buildElementId(resultId, name);

  return `<div class="column-editor notification-parser-panel">
      <div class="column-editor__header">Parsed Messages</div>
      <p class="muted">Review notification messages collected from User Notifications. Messages sync live while a subscription is active.</p>
      <div class="parser-toolbar">
        <label class="parser-filter">
          <input id="${escapeHtml(id("hideRawFilter"))}" type="checkbox" checked />
          Hide raw messages
        </label>
        <button id="${escapeHtml(id("expandCardsBtn"))}" type="button" class="notification-parser-action" data-parser-action="expand-cards" data-result-id="${escapeHtml(
          resultId
        )}">Expand All Cards</button>
        <button id="${escapeHtml(id("collapseCardsBtn"))}" type="button" class="secondary notification-parser-action" data-parser-action="collapse-cards" data-result-id="${escapeHtml(
          resultId
        )}">Collapse All Cards</button>
        <button id="${escapeHtml(id("expandJsonBtn"))}" type="button" class="notification-parser-action" data-parser-action="expand-json" data-result-id="${escapeHtml(
          resultId
        )}">Expand All JSON</button>
        <button id="${escapeHtml(id("collapseJsonBtn"))}" type="button" class="secondary notification-parser-action" data-parser-action="collapse-json" data-result-id="${escapeHtml(
          resultId
        )}">Collapse All JSON</button>
        <button id="${escapeHtml(id("clearImportBtn"))}" type="button" class="danger notification-parser-action" data-parser-action="clear" data-result-id="${escapeHtml(
          resultId
        )}">Clear Import</button>
      </div>
      <div class="parser-summary">
        <div><strong>Messages:</strong> <span id="${escapeHtml(id("messageCount"))}">0</span></div>
        <div><strong>Exported:</strong> <span id="${escapeHtml(id("exportedAt"))}">Not available</span></div>
        <div><strong>Source:</strong> <span id="${escapeHtml(id("sourceLabel"))}">No import found</span></div>
        <div><strong>User:</strong> <span id="${escapeHtml(id("userLabel"))}">Not available</span></div>
      </div>
      <div id="${escapeHtml(id("emptyState"))}" class="parser-empty" hidden>
        <p>No exported notification messages were found in this browser session.</p>
        <p>Open <strong>User Notifications</strong> under Quick Actions, start a subscription, then return here to review parsed messages.</p>
      </div>
      <div id="${escapeHtml(id("messageList"))}" class="message-list" aria-live="polite"></div>
    </div>`;
};

const mountNotificationMessageParserView = (resultId = "") => {
  const id = (name) => buildElementId(resultId, name);
  const messageCountEl = document.getElementById(id("messageCount"));
  const exportedAtEl = document.getElementById(id("exportedAt"));
  const sourceEl = document.getElementById(id("sourceLabel"));
  const userEl = document.getElementById(id("userLabel"));
  const messageListEl = document.getElementById(id("messageList"));
  const emptyStateEl = document.getElementById(id("emptyState"));
  const hideRawFilterEl = document.getElementById(id("hideRawFilter"));

  if (!messageListEl || !messageCountEl) {
    return null;
  }

  let exportedData = null;
  let lastRenderedSignature = "";
  let hideRawMessages = localStorage.getItem(HIDE_RAW_KEY) !== "0";

  const getExportSignature = (exported) => {
    const messages = Array.isArray(exported?.messages) ? exported.messages : [];
    const firstId = messages[0]?.id || "";
    const lastId = messages[messages.length - 1]?.id || "";

    return `${exported?.exportedAt || ""}:${messages.length}:${firstId}:${lastId}:${hideRawMessages ? "1" : "0"}`;
  };

  const updateMessageCount = (totalCount, visibleCount) => {
    if (hideRawMessages && visibleCount !== totalCount) {
      messageCountEl.textContent = `${visibleCount} shown (${totalCount} total)`;
      return;
    }

    messageCountEl.textContent = String(visibleCount);
  };

  const renderExport = (exported) => {
    const messages = Array.isArray(exported?.messages) ? exported.messages : [];
    const visibleMessages = getVisibleMessages(messages, hideRawMessages);

    updateMessageCount(messages.length, visibleMessages.length);
    exportedAtEl.textContent = formatParserTimestamp(exported?.exportedAt);
    sourceEl.textContent = exported?.source || "Unknown source";
    userEl.textContent = exported?.userName
      ? `${exported.userName}${exported.userId ? ` (${exported.userId})` : ""}`
      : exported?.userId || "Not available";

    if (!messages.length) {
      emptyStateEl.hidden = false;
      emptyStateEl.innerHTML =
        "<p>No exported notification messages were found in this browser session.</p>" +
        "<p>Open <strong>User Notifications</strong> under Quick Actions, start a subscription, then return here to review parsed messages.</p>";
      messageListEl.innerHTML = "";
      return;
    }

    if (!visibleMessages.length) {
      emptyStateEl.hidden = false;
      emptyStateEl.innerHTML =
        `<p>All ${messages.length} messages are hidden by the current filter.</p>` +
        "<p>Uncheck <strong>Hide raw messages</strong> to show them again.</p>";
      messageListEl.innerHTML = "";
      return;
    }

    emptyStateEl.hidden = true;
    renderMessageList(messageListEl, messages, {
      hideRawMessages,
      openFirst: 3,
      expandJson: true,
    });
  };

  const refresh = (exported = loadNotificationMessageExport()) => {
    const signature = getExportSignature(exported || { messages: [] });
    if (signature === lastRenderedSignature) {
      return;
    }

    lastRenderedSignature = signature;
    exportedData = exported;
    renderExport(exportedData || { messages: [] });
  };

  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) {
      refresh();
    }
  };

  if (hideRawFilterEl) {
    hideRawFilterEl.checked = hideRawMessages;
    hideRawFilterEl.addEventListener("change", () => {
      hideRawMessages = hideRawFilterEl.checked;
      localStorage.setItem(HIDE_RAW_KEY, hideRawMessages ? "1" : "0");
      lastRenderedSignature = "";
      refresh(exportedData);
    });
  }

  const unsubscribe = subscribeNotificationMessageExport((exported) => {
    refresh(exported);
  });

  window.addEventListener("storage", onStorage);
  refresh();

  return {
    refresh,
    destroy: () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    },
    expandAllCards: () => {
      messageListEl.querySelectorAll("details.message-card").forEach((card) => {
        card.open = true;
      });
    },
    collapseAllCards: () => {
      messageListEl.querySelectorAll("details.message-card").forEach((card) => {
        card.open = false;
      });
    },
    expandAllJson: () => {
      setAllJsonTreeExpanded(messageListEl, true);
    },
    collapseAllJson: () => {
      setAllJsonTreeExpanded(messageListEl, false);
    },
    clearImport: () => {
      clearNotificationMessageExport();
      lastRenderedSignature = "";
      refresh({ messages: [] });
    },
  };
};

export {
  escapeHtml,
  mountNotificationMessageParserView,
  renderNotificationMessageParserPanel,
};
