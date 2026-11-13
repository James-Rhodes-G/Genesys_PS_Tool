const createParsedChatAgentEntry = ({
  direction = "inbound",
  category = "inbound",
  eventType = "message",
  summaryText = "",
  data = {},
} = {}) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  timestamp: new Date().toISOString(),
  label: summaryText || eventType || category,
  category,
  direction,
  eventType,
  topicName: direction,
  data,
});

const classifyGuestFrame = (payload, direction) => {
  const eventType = String(
    payload?.eventType || payload?.type || payload?.action || payload?.class || "frame"
  );
  const normalized = eventType.toLowerCase();

  if (normalized.includes("typing")) {
    return createParsedChatAgentEntry({
      direction,
      category: "raw",
      eventType,
      summaryText: "Typing indicator",
      data: payload,
    });
  }

  if (normalized.includes("error") || payload?.error) {
    return createParsedChatAgentEntry({
      direction,
      category: "session",
      eventType,
      summaryText: payload?.error?.message || payload?.message || "Session error",
      data: payload,
    });
  }

  if (direction === "outbound") {
    return createParsedChatAgentEntry({
      direction,
      category: "outbound",
      eventType,
      summaryText: extractGuestText(payload) || "Outbound frame",
      data: payload,
    });
  }

  const text = extractGuestText(payload);
  return createParsedChatAgentEntry({
    direction,
    category: text ? "inbound" : "raw",
    eventType,
    summaryText: text || eventType,
    data: payload,
  });
};

const extractGuestText = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = [
    payload.text,
    payload.body?.text,
    payload.message?.text,
    payload.message?.body?.text,
    payload.eventBody?.text,
    payload.content?.text,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (Array.isArray(payload.quickReplies)) {
    return payload.quickReplies.map((entry) => entry.text || entry.label).filter(Boolean).join(" | ");
  }

  if (Array.isArray(payload.suggestedActions)) {
    return payload.suggestedActions.map((entry) => entry.text || entry.label).filter(Boolean).join(" | ");
  }

  return "";
};

const extractGuestQuickReplies = (payload) => {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const list =
    payload.quickReplies ||
    payload.suggestedActions ||
    payload.message?.quickReplies ||
    payload.message?.suggestedActions ||
    [];

  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .map((entry) => ({
      text: String(entry.text || entry.label || entry.value || "").trim(),
      value: String(entry.value || entry.text || entry.label || "").trim(),
    }))
    .filter((entry) => entry.text);
};

const mapGuideTurnToEntries = (direction, requestBody, responseBody) => {
  const entries = [];
  if (requestBody) {
    entries.push(
      createParsedChatAgentEntry({
        direction: "outbound",
        category: "outbound",
        eventType: "guideTurnRequest",
        summaryText: extractGuideTurnInput(requestBody),
        data: requestBody,
      })
    );
  }
  if (responseBody) {
    entries.push(
      createParsedChatAgentEntry({
        direction: "inbound",
        category: "inbound",
        eventType: "guideTurnResponse",
        summaryText: extractGuideTurnOutput(responseBody),
        data: responseBody,
      })
    );
  }
  return entries;
};

const extractGuideTurnInput = (body) => {
  if (!body || typeof body !== "object") {
    return "";
  }
  const candidates = [body.input, body.text, body.message, body.userInput, body.query];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return JSON.stringify(body);
};

const extractGuideTurnOutput = (body) => {
  if (!body || typeof body !== "object") {
    return "";
  }
  const candidates = [
    body.output,
    body.response,
    body.message,
    body.text,
    body.agentMessage,
    body.assistantMessage,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  if (Array.isArray(body.messages)) {
    return body.messages
      .map((entry) => entry.text || entry.content || entry.message)
      .filter(Boolean)
      .join("\n");
  }
  return JSON.stringify(body);
};

export {
  classifyGuestFrame,
  createParsedChatAgentEntry,
  extractGuestQuickReplies,
  extractGuestText,
  extractGuideTurnInput,
  extractGuideTurnOutput,
  mapGuideTurnToEntries,
};
