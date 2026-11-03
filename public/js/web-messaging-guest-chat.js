import { buildWebMessagingTokenUrl, buildWebMessagingWsUrl } from "./web-messaging-domain-client.js";
import {
  appendChatAgentMessage,
  resetChatAgentMessageExport,
} from "./chat-agent-message-store.js";
import {
  classifyGuestFrame,
  createParsedChatAgentEntry,
  extractGuestQuickReplies,
  extractGuestText,
} from "./chat-agent-message-parser.js";

const parseJsonSafe = (raw) => {
  if (typeof raw !== "string") {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
};

const extractToken = (payload) =>
  payload?.jwt || payload?.token || payload?.accessToken || payload?.access_token || "";

const createWebMessagingGuestChat = ({
  region,
  deploymentId,
  onStatus,
  onConversationMessage,
  onQuickReplies,
  onConversationId,
} = {}) => {
  let socket = null;
  let jwt = "";
  let conversationId = "";
  let closed = false;

  const emitStatus = (message) => onStatus?.(message || "");

  const traceFrame = (direction, payload) => {
    const entry = classifyGuestFrame(payload, direction);
    appendChatAgentMessage(entry, {
      deploymentId,
      conversationId,
      mode: "webDeployment",
    });
    return entry;
  };

  const handleInboundPayload = (payload) => {
    traceFrame("inbound", payload);

    const nextConversationId =
      payload?.conversationId ||
      payload?.conversation?.id ||
      payload?.eventBody?.conversationId ||
      conversationId;

    if (nextConversationId && nextConversationId !== conversationId) {
      conversationId = nextConversationId;
      onConversationId?.(conversationId);
    }

    const text = extractGuestText(payload);
    if (text) {
      onConversationMessage?.({
        role: "bot",
        text,
        timestamp: new Date().toISOString(),
        raw: payload,
      });
    }

    const quickReplies = extractGuestQuickReplies(payload);
    if (quickReplies.length) {
      onQuickReplies?.(quickReplies);
    }
  };

  const connectWebSocket = async () => {
    const wsUrl = await buildWebMessagingWsUrl(region, deploymentId, jwt);
    if (!wsUrl) {
      throw new Error("Unable to build Web Messaging WebSocket URL for this region.");
    }

    await new Promise((resolve, reject) => {
      socket = new WebSocket(wsUrl);
      socket.addEventListener("open", () => {
        emitStatus("WebSocket connected.");
        resolve();
      });
      socket.addEventListener("error", () => {
        reject(new Error("WebSocket connection failed. Check deployment domain allowlist."));
      });
      socket.addEventListener("message", (event) => {
        handleInboundPayload(parseJsonSafe(event.data));
      });
      socket.addEventListener("close", () => {
        if (!closed) {
          emitStatus("WebSocket closed.");
        }
      });
    });
  };

  const fetchDeploymentToken = async () => {
    const tokenUrl = await buildWebMessagingTokenUrl(region, deploymentId);
    if (!tokenUrl) {
      throw new Error("Unable to resolve Web Messaging host for this region.");
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const payload = await response.json().catch(() => ({}));
    traceFrame("inbound", { eventType: "tokenResponse", status: response.status, body: payload });

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || `Token request failed (${response.status}).`);
    }

    jwt = extractToken(payload);
    if (!jwt) {
      throw new Error("Token response did not include a JWT.");
    }
  };

  const start = async () => {
    closed = false;
    resetChatAgentMessageExport({ deploymentId, mode: "webDeployment" });
    appendChatAgentMessage(
      createParsedChatAgentEntry({
        direction: "outbound",
        category: "session",
        eventType: "sessionStart",
        summaryText: "Starting guest session",
        data: { deploymentId, region },
      }),
      { deploymentId, mode: "webDeployment" }
    );

    emitStatus("Requesting guest token...");
    await fetchDeploymentToken();
    emitStatus("Connecting WebSocket...");
    await connectWebSocket();
  };

  const sendText = async (text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) {
      return;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Chat session is not connected.");
    }

    const frame = {
      action: "onMessage",
      token: jwt,
      message: {
        type: "Text",
        text: trimmed,
      },
    };

    traceFrame("outbound", frame);
    socket.send(JSON.stringify(frame));

    onConversationMessage?.({
      role: "customer",
      text: trimmed,
      timestamp: new Date().toISOString(),
      raw: frame,
    });
  };

  const sendQuickReply = async (value) => sendText(value);

  const end = () => {
    closed = true;
    if (socket) {
      socket.close();
      socket = null;
    }
    appendChatAgentMessage(
      createParsedChatAgentEntry({
        direction: "outbound",
        category: "session",
        eventType: "sessionEnd",
        summaryText: "Session ended",
        data: { deploymentId, conversationId },
      }),
      { deploymentId, conversationId, mode: "webDeployment" }
    );
    emitStatus("Session ended.");
  };

  const getConversationId = () => conversationId;

  return {
    start,
    sendText,
    sendQuickReply,
    end,
    getConversationId,
  };
};

export { createWebMessagingGuestChat, extractToken, parseJsonSafe };
