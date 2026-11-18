const isBotRole = (role) => role === "bot" || role === "agent";

const turnsFromConversationMessages = (messages = []) =>
  (messages || []).map((entry) => ({
    role: entry.role === "customer" ? "customer" : isBotRole(entry.role) ? "bot" : entry.role,
    text: String(entry.text || "").trim(),
    timestamp: entry.timestamp || "",
    raw: entry.raw,
  }));

const lastBotTurn = (messages = []) => {
  const turns = turnsFromConversationMessages(messages);
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turns[index].role === "bot" && turns[index].text) {
      return turns[index];
    }
  }
  return null;
};

const parseAutomationSteps = (rawText) =>
  String(rawText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipeIndex = line.indexOf("|");
      if (pipeIndex === -1) {
        return { utterance: line, expected: "" };
      }
      return {
        utterance: line.slice(0, pipeIndex).trim(),
        expected: line.slice(pipeIndex + 1).trim(),
      };
    })
    .filter((step) => step.utterance);

export { turnsFromConversationMessages, lastBotTurn, parseAutomationSteps, isBotRole };
