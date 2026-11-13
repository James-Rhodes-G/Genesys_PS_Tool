import { setAllJsonTreeExpanded } from "./json-tree.js";
import { renderMessageList } from "./message-cards.js";
import { formatParserTimestamp } from "./notification-message-parser.js";
import {
  clearChatAgentMessages,
  loadChatAgentMessageExport,
  subscribeChatAgentMessages,
} from "./chat-agent-message-store.js";

const HIDE_CONTROL_KEY = "ps_tool_chat_agent_hide_control_frames";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildElementId = (resultId, name) => (resultId ? `${resultId}-${name}` : name);

const getVisibleTraceMessages = (messages, hideControlFrames) => {
  if (!hideControlFrames) {
    return messages;
  }
  return messages.filter((message) => message.category !== "raw" && message.category !== "session");
};

const renderChatAgentTracePanel = ({ resultId = "" } = {}) => {
  const id = (name) => buildElementId(resultId, name);

  return `<div class="notification-parser-panel chat-agent-trace">
    <div class="column-editor__header">Message trace</div>
    <p class="muted">Live WebSocket / API frames for this chat session.</p>
    <div class="parser-toolbar">
      <label class="parser-filter">
        <input id="${escapeHtml(id("hideControlFilter"))}" type="checkbox" checked />
        Hide raw/control frames
      </label>
      <button type="button" class="notification-parser-action" data-trace-action="expand-cards" data-result-id="${escapeHtml(
        resultId
      )}">Expand All Cards</button>
      <button type="button" class="secondary notification-parser-action" data-trace-action="collapse-cards" data-result-id="${escapeHtml(
        resultId
      )}">Collapse All Cards</button>
      <button type="button" class="notification-parser-action" data-trace-action="expand-json" data-result-id="${escapeHtml(
        resultId
      )}">Expand All JSON</button>
      <button type="button" class="secondary notification-parser-action" data-trace-action="collapse-json" data-result-id="${escapeHtml(
        resultId
      )}">Collapse All JSON</button>
      <button type="button" class="danger notification-parser-action" data-trace-action="clear" data-result-id="${escapeHtml(
        resultId
      )}">Clear trace</button>
    </div>
    <div class="parser-summary">
      <div><strong>Messages:</strong> <span id="${escapeHtml(id("traceCount"))}">0</span></div>
      <div><strong>Updated:</strong> <span id="${escapeHtml(id("traceUpdated"))}">—</span></div>
    </div>
    <div id="${escapeHtml(id("traceList"))}" class="message-list" aria-live="polite"></div>
  </div>`;
};

const mountChatAgentTraceView = (resultId = "", { onClear } = {}) => {
  const id = (name) => buildElementId(resultId, name);
  const traceListEl = document.getElementById(id("traceList"));
  const traceCountEl = document.getElementById(id("traceCount"));
  const traceUpdatedEl = document.getElementById(id("traceUpdated"));
  const hideControlFilterEl = document.getElementById(id("hideControlFilter"));

  if (!traceListEl || !traceCountEl) {
    return null;
  }

  let hideControlFrames = localStorage.getItem(HIDE_CONTROL_KEY) !== "0";
  if (hideControlFilterEl) {
    hideControlFilterEl.checked = hideControlFrames;
  }

  const renderExport = (exported) => {
    const messages = Array.isArray(exported?.messages) ? exported.messages : [];
    const visible = getVisibleTraceMessages(messages, hideControlFrames);
    traceCountEl.textContent =
      hideControlFrames && visible.length !== messages.length
        ? `${visible.length} shown (${messages.length} total)`
        : String(visible.length);
    traceUpdatedEl.textContent = formatParserTimestamp(exported?.exportedAt);

    renderMessageList(traceListEl, visible, {
      hideRawMessages: false,
      openFirst: 2,
      expandJson: false,
      emptyText: "No traced messages yet. Start a chat session to capture frames.",
    });
  };

  const refresh = () => renderExport(loadChatAgentMessageExport() || { messages: [] });

  hideControlFilterEl?.addEventListener("change", () => {
    hideControlFrames = hideControlFilterEl.checked;
    localStorage.setItem(HIDE_CONTROL_KEY, hideControlFrames ? "1" : "0");
    refresh();
  });

  document.querySelectorAll(`[data-trace-action][data-result-id="${resultId}"]`).forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.traceAction;
      if (action === "clear") {
        clearChatAgentMessages();
        onClear?.();
        refresh();
        return;
      }

      const cards = traceListEl.querySelectorAll(".message-card");
      if (action === "expand-cards" || action === "collapse-cards") {
        cards.forEach((card) => {
          card.open = action === "expand-cards";
        });
        return;
      }

      setAllJsonTreeExpanded(traceListEl, action === "expand-json");
    });
  });

  const unsubscribe = subscribeChatAgentMessages(refresh);
  refresh();

  return { refresh, unsubscribe };
};

export { mountChatAgentTraceView, renderChatAgentTracePanel, getVisibleTraceMessages };
