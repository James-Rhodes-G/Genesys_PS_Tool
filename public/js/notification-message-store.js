const STORAGE_KEY = "ps_tool_notification_message_export";
const BROADCAST_CHANNEL_NAME = "ps_tool_notification_messages";

let broadcastChannel = null;

try {
  if (typeof BroadcastChannel !== "undefined") {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch {
  broadcastChannel = null;
}

const getStorage = () => {
  if (typeof localStorage !== "undefined") {
    return localStorage;
  }

  return typeof sessionStorage !== "undefined" ? sessionStorage : null;
};

const createEmptyExport = () => ({
  exportedAt: new Date().toISOString(),
  source: "User Notifications",
  sourceUrl: "/",
  userId: "",
  userName: "",
  messages: [],
});

const notifyMessageExportUpdated = (exported) => {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: "updated",
      at: Date.now(),
      exported,
    });
  }
};

const loadNotificationMessageExport = () => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveNotificationMessageExport = (exported) => {
  const storage = getStorage();
  if (!storage) {
    return exported;
  }

  const nextExport = {
    ...exported,
    exportedAt: new Date().toISOString(),
  };

  storage.setItem(STORAGE_KEY, JSON.stringify(nextExport));
  notifyMessageExportUpdated(nextExport);
  return nextExport;
};

const resetNotificationMessageExport = ({ userId = "", userName = "" } = {}) => {
  const nextExport = {
    ...createEmptyExport(),
    userId,
    userName,
    messages: [],
  };

  return saveNotificationMessageExport(nextExport);
};

const initNotificationMessageExport = ({ userId = "", userName = "" } = {}) =>
  resetNotificationMessageExport({ userId, userName });

const appendNotificationMessage = (entry, { userId = "", userName = "" } = {}) => {
  const exported =
    loadNotificationMessageExport() ||
    resetNotificationMessageExport({
      userId,
      userName,
    });

  exported.messages = [entry, ...(exported.messages || [])];
  if (userId) {
    exported.userId = userId;
  }
  if (userName) {
    exported.userName = userName;
  }

  return saveNotificationMessageExport(exported);
};

const clearNotificationMessageExport = () => {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(STORAGE_KEY);
  }

  notifyMessageExportUpdated(createEmptyExport());
};

const subscribeNotificationMessageExport = (listener) => {
  if (typeof listener !== "function") {
    return () => {};
  }

  const handleStorage = (event) => {
    if (event.key === STORAGE_KEY) {
      listener(loadNotificationMessageExport());
    }
  };

  const handleBroadcast = (event) => {
    if (event?.data?.type === "updated") {
      listener(event.data.exported || loadNotificationMessageExport());
    }
  };

  window.addEventListener("storage", handleStorage);
  if (broadcastChannel) {
    broadcastChannel.addEventListener("message", handleBroadcast);
  }

  return () => {
    window.removeEventListener("storage", handleStorage);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener("message", handleBroadcast);
    }
  };
};

const closeNotificationMessageBroadcast = () => {
  if (broadcastChannel) {
    broadcastChannel.close();
    broadcastChannel = null;
  }
};

export {
  BROADCAST_CHANNEL_NAME,
  STORAGE_KEY,
  appendNotificationMessage,
  closeNotificationMessageBroadcast,
  clearNotificationMessageExport,
  initNotificationMessageExport,
  loadNotificationMessageExport,
  resetNotificationMessageExport,
  saveNotificationMessageExport,
  subscribeNotificationMessageExport,
};
