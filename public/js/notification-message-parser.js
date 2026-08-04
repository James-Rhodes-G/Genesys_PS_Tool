const getNotificationMessageLabel = (message) => {
  if (message?.topicName) {
    return message.topicName;
  }

  if (message?.eventBody?.type) {
    return String(message.eventBody.type);
  }

  return "notification";
};

const formatParserTimestamp = (value) => {
  if (!value) {
    return "Unknown time";
  }

  return String(value).replace("T", " ").replace("Z", " UTC");
};

const createParsedMessageEntry = (message) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  timestamp: new Date().toISOString(),
  label: getNotificationMessageLabel(message),
  category: message?.topicName || "notification",
  topicName: message?.topicName || "",
  data: message,
});

const createNotificationMessageHandler = ({ onParsedMessage, onError }) => {
  const handleNotificationPayload = async (rawPayload) => {
    let message = rawPayload;

    if (typeof rawPayload === "string") {
      try {
        message = JSON.parse(rawPayload);
      } catch (error) {
        onError?.({
          label: "WSS Message Parse Error",
          payload: {
            message: error.message,
            rawMessage: rawPayload,
          },
        });
        return;
      }
    }

    onParsedMessage?.(createParsedMessageEntry(message));
  };

  return {
    handleNotificationPayload,
    reset: () => {},
  };
};

export {
  createNotificationMessageHandler,
  createParsedMessageEntry,
  formatParserTimestamp,
  getNotificationMessageLabel,
};
