import { buildWebMessagingWsCandidates } from "./web-messaging-domain-client.js";
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
  requestGuestToken,
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
    const candidates = await buildWebMessagingWsCandidates(region, deploymentId, jwt);
    if (!candidates.length) {
      throw new Error("Unable to build Web Messaging WebSocket URL for this region.");
    }

    let lastError = null;

    for (const wsUrl of candidates) {
      try {
        await new Promise((resolve, reject) => {
          socket = new WebSocket(wsUrl);
          socket.addEventListener("open", () => {
            traceFrame("outbound", { eventType: "websocketOpen", url: wsUrl });
            if (jwt && wsUrl.includes("deploymentId=") && !wsUrl.includes("token=")) {
              const configureFrame = {
                action: "configureSession",
                deploymentId,
                token: jwt,
              };
              traceFrame("outbound", configureFrame);
              socket.send(JSON.stringify(configureFrame));
            }
            emitStatus("WebSocket connected.");
            resolve();
          });
          socket.addEventListener("error", () => {
            reject(new Error("WebSocket connection failed."));
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
        return;
      } catch (error) {
        lastError = error;
        socket = null;
      }
    }

    throw lastError || new Error("WebSocket connection failed. Check deployment domain allowlist and region.");
  };

  const fetchDeploymentToken = async () => {
    if (typeof requestGuestToken !== "function") {
      throw new Error("Guest token request handler is not configured.");
    }

    const result = await requestGuestToken();
    traceFrame("inbound", {
      eventType: "tokenResponse",
      body: result?.payload || result,
      origin: result?.origin,
    });

    jwt = extractToken(result?.payload || result) || result?.token || "";
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
