const STORAGE_KEY = "ps_tool_chat_agent_message_trace";
const BROADCAST_CHANNEL_NAME = "ps_tool_chat_agent_messages";

let broadcastChannel = null;
let inMemoryExport = null;

try {
  if (typeof BroadcastChannel !== "undefined") {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch {
  broadcastChannel = null;
}

const createEmptyExport = () => ({
  exportedAt: new Date().toISOString(),
  source: "Chat Agent Tester",
  deploymentId: "",
  conversationId: "",
  guideSessionId: "",
  mode: "webDeployment",
  messages: [],
});

const notifyUpdated = (exported) => {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: "updated", at: Date.now(), exported });
  }
};

const loadChatAgentMessageExport = () => {
  if (inMemoryExport) {
    return inMemoryExport;
  }

  if (typeof sessionStorage === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    inMemoryExport = JSON.parse(raw);
    return inMemoryExport;
  } catch {
    return null;
  }
};

const saveChatAgentMessageExport = (exported) => {
  const nextExport = {
    ...exported,
    exportedAt: new Date().toISOString(),
  };
  inMemoryExport = nextExport;

  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextExport));
  }

  notifyUpdated(nextExport);
  return nextExport;
};

const resetChatAgentMessageExport = (meta = {}) => {
  const nextExport = {
    ...createEmptyExport(),
    ...meta,
    messages: [],
  };
  return saveChatAgentMessageExport(nextExport);
};

const appendChatAgentMessage = (entry, meta = {}) => {
  const exported =
    loadChatAgentMessageExport() ||
    resetChatAgentMessageExport(meta);

  exported.messages = [...(exported.messages || []), entry];
  Object.assign(exported, meta);
  return saveChatAgentMessageExport(exported);
};

const clearChatAgentMessages = (meta = {}) => resetChatAgentMessageExport(meta);

const subscribeChatAgentMessages = (listener) => {
  if (typeof listener !== "function") {
    return () => {};
  }

  const handleBroadcast = (event) => {
    if (event?.data?.type === "updated") {
      listener(event.data.exported || loadChatAgentMessageExport());
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener("message", handleBroadcast);
  }

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener("message", handleBroadcast);
    }
  };
};

export {
  appendChatAgentMessage,
  clearChatAgentMessages,
  loadChatAgentMessageExport,
  resetChatAgentMessageExport,
  subscribeChatAgentMessages,
};
