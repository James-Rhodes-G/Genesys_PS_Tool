const store = {};

global.localStorage = {
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
  },
  setItem(key, value) {
    store[key] = String(value);
  },
  removeItem(key) {
    delete store[key];
  },
};

global.sessionStorage = global.localStorage;

const {
  appendNotificationMessage,
  loadNotificationMessageExport,
  resetNotificationMessageExport,
  STORAGE_KEY,
} = await import("../public/js/notification-message-store.js");

resetNotificationMessageExport({ userId: "user-1", userName: "Test User" });

appendNotificationMessage(
  {
    id: "msg-1",
    timestamp: "2026-08-03T20:00:00.000Z",
    label: "v2.users.user-1.conversations",
    category: "v2.users.user-1.conversations",
    topicName: "v2.users.user-1.conversations",
    data: { topicName: "v2.users.user-1.conversations", eventBody: { id: "conv-1" } },
  },
  { userId: "user-1", userName: "Test User" }
);

const exported = loadNotificationMessageExport();

if (!exported) {
  throw new Error("Expected exported notification messages in session storage.");
}

if (exported.messages.length !== 1) {
  throw new Error(`Expected 1 message, received ${exported.messages.length}.`);
}

if (exported.messages[0].id !== "msg-1") {
  throw new Error("Expected the appended message to be stored.");
}

if (!store[STORAGE_KEY]) {
  throw new Error("Expected session storage key to be written.");
}

console.log("notification-message-store validation passed");
