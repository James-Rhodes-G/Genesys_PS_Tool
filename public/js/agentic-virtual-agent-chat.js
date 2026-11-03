import {
  appendChatAgentMessage,
  resetChatAgentMessageExport,
} from "./chat-agent-message-store.js";
import {
  createParsedChatAgentEntry,
  extractGuideTurnOutput,
  mapGuideTurnToEntries,
} from "./chat-agent-message-parser.js";

const createSessionId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const buildTurnRequestBody = (text) => ({
  input: {
    type: "text",
    text: String(text || "").trim(),
  },
});

const createAgenticVirtualAgentChat = ({
  region,
  token,
  guideId,
  virtualAgentId,
  addAgenticGuideSessionTurn,
  onStatus,
  onConversationMessage,
} = {}) => {
  let guideSessionId = createSessionId();

  const emitStatus = (message) => onStatus?.(message || "");

  const start = async () => {
    guideSessionId = createSessionId();
    resetChatAgentMessageExport({
      mode: "agenticAgent",
      virtualAgentId,
      guideSessionId,
    });
    appendChatAgentMessage(
      createParsedChatAgentEntry({
        direction: "outbound",
        category: "session",
        eventType: "guideSessionStart",
        summaryText: `Guide session ${guideSessionId}`,
        data: { guideId, virtualAgentId, guideSessionId },
      }),
      { mode: "agenticAgent", guideSessionId, virtualAgentId }
    );
    emitStatus("Agentic session ready. Send a message to start the conversation.");
  };

  const sendText = async (text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) {
      return;
    }
    if (!guideId) {
      throw new Error("Selected agent does not expose a guideId for session turns.");
    }

    const requestBody = buildTurnRequestBody(trimmed);
    const result = await addAgenticGuideSessionTurn({
      region,
      token,
      guideId,
      guideSessionId,
      body: requestBody,
    });

    mapGuideTurnToEntries("outbound", requestBody, result).forEach((entry) => {
      appendChatAgentMessage(entry, {
        mode: "agenticAgent",
        guideSessionId,
        virtualAgentId,
      });
    });

    onConversationMessage?.({
      role: "customer",
      text: trimmed,
      timestamp: new Date().toISOString(),
      raw: requestBody,
    });

    const reply = extractGuideTurnOutput(result);
    if (reply) {
      onConversationMessage?.({
        role: "bot",
        text: reply,
        timestamp: new Date().toISOString(),
        raw: result,
      });
    }
  };

  const end = () => {
    appendChatAgentMessage(
      createParsedChatAgentEntry({
        direction: "outbound",
        category: "session",
        eventType: "guideSessionEnd",
        summaryText: "Session ended",
        data: { guideId, guideSessionId },
      }),
      { mode: "agenticAgent", guideSessionId, virtualAgentId }
    );
    emitStatus("Session ended.");
  };

  const getGuideSessionId = () => guideSessionId;

  return {
    start,
    sendText,
    end,
    getGuideSessionId,
  };
};

export { createAgenticVirtualAgentChat, buildTurnRequestBody, createSessionId };
