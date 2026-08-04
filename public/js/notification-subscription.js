import { resolveEntityTopics } from "./notification-topics.js";

const DEFAULT_USER_TOPICS = [
  "v2.users.{userId}.conversations",
  "v2.users.{userId}.alerting.alerts",
];

const DEFAULT_USER_TOPICS_TEXT = DEFAULT_USER_TOPICS.join("\n");

const normalizeTopicInput = (topics) => {
  if (Array.isArray(topics)) {
    return topics.map((topic) => String(topic || "").trim()).filter(Boolean);
  }

  if (typeof topics === "string") {
    return topics
      .split(/\r?\n|,/)
      .map((topic) => topic.trim())
      .filter(Boolean);
  }

  return [];
};

const resolveUserTopics = (userId, topics) =>
  resolveEntityTopics(userId, normalizeTopicInput(topics), {
    defaultTopics: DEFAULT_USER_TOPICS,
    placeholderKeys: ["{id}", "{userId}"],
  });

const createNotificationSubscriptionManager = ({
  createChannel,
  subscribeTopics,
  deleteChannel,
  onMessage,
  onStatusChange,
  onError,
} = {}) => {
  let webSocket = null;
  let channelId = null;
  let userId = null;
  let status = "idle";

  const setStatus = (nextStatus) => {
    status = nextStatus;
    onStatusChange?.(nextStatus);
  };

  const reportError = (error) => {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  };

  const openWebSocket = (connectUri) =>
    new Promise((resolve, reject) => {
      const socket = new WebSocket(connectUri);
      let opened = false;

      socket.onopen = () => {
        opened = true;
        webSocket = socket;
        resolve();
      };

      socket.onerror = () => {
        if (!opened) {
          reject(new Error("Failed to open the notifications WebSocket."));
          return;
        }

        reportError(new Error("WebSocket reported an error after opening."));
      };

      socket.onclose = (event) => {
        onMessage?.({
          type: "websocket_closed",
          payload: {
            code: event.code,
            reason: event.reason || "No close reason provided",
          },
        });
      };

      socket.onmessage = (event) => {
        let payload = event.data;

        try {
          payload = JSON.parse(event.data);
        } catch {
          // Keep the raw payload when the message is not JSON.
        }

        onMessage?.({
          type: "notification",
          payload,
        });
      };
    });

  const stop = async () => {
    if (webSocket) {
      webSocket.onclose = null;
      webSocket.close();
      webSocket = null;
    }

    if (channelId) {
      try {
        await deleteChannel({ channelId });
      } catch (error) {
        reportError(error);
      }
    }

    channelId = null;
    userId = null;
    setStatus("idle");
  };

  const start = async ({ userId, entityId, topics, resolvedTopics, topicOptions } = {}) => {
    await stop();

    const normalizedEntityId = String(entityId || userId || "").trim();
    if (!normalizedEntityId) {
      throw new Error("Entity ID is required.");
    }

    userId = normalizedEntityId;
    const finalTopics =
      Array.isArray(resolvedTopics) && resolvedTopics.length
        ? resolvedTopics
        : topicOptions
          ? resolveEntityTopics(normalizedEntityId, normalizeTopicInput(topics), topicOptions)
          : resolveUserTopics(normalizedEntityId, topics);

    setStatus("creating_channel");
    const channel = await createChannel();
    channelId = channel.id;

    setStatus("opening_websocket");
    await openWebSocket(channel.connectUri);

    setStatus("subscribing");
    await subscribeTopics({ channelId: channel.id, topics: finalTopics });

    setStatus("listening");

    return {
      channelId: channel.id,
      userId: normalizedEntityId,
      resolvedTopics: finalTopics,
      connectUri: channel.connectUri,
    };
  };

  return {
    start,
    stop,
    getStatus: () => status,
    getChannelId: () => channelId,
    getUserId: () => userId,
  };
};

export {
  DEFAULT_USER_TOPICS,
  DEFAULT_USER_TOPICS_TEXT,
  createNotificationSubscriptionManager,
  normalizeTopicInput,
  resolveUserTopics,
};
