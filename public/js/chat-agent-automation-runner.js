import { evaluateBotResponse } from "./chat-agent-response-eval.js";
import { lastBotTurn, parseAutomationSteps } from "./chat-agent-transcript.js";

const waitFor = (predicate, { timeoutMs = 30_000, intervalMs = 100 } = {}) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      try {
        if (predicate()) {
          resolve(true);
          return;
        }
      } catch (error) {
        reject(error);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("Timed out waiting for bot response."));
        return;
      }
      window.setTimeout(tick, intervalMs);
    };
    tick();
  });

const runConversationAutomation = async ({
  scriptText,
  sendUtterance,
  getConversationMessages,
  match = "contains",
  stepDelayMs = 400,
  responseTimeoutMs = 45_000,
  onStepStart,
  onStepComplete,
} = {}) => {
  const steps = parseAutomationSteps(scriptText);
  if (!steps.length) {
    throw new Error("Add at least one utterance line to the automation script.");
  }
  if (typeof sendUtterance !== "function") {
    throw new Error("Automation send handler is not available for this session.");
  }

  const results = [];

  for (const [index, step] of steps.entries()) {
    onStepStart?.({ index, step });
    const botCountBefore = (getConversationMessages() || []).filter((entry) => entry.role === "bot").length;

    await sendUtterance(step.utterance);
    await waitFor(
      () => {
        const messages = getConversationMessages() || [];
        const botCountAfter = messages.filter((entry) => entry.role === "bot").length;
        if (botCountAfter > botCountBefore) {
          return true;
        }
        const lastBot = lastBotTurn(messages);
        return Boolean(lastBot?.text);
      },
      { timeoutMs: responseTimeoutMs }
    );

    const messages = getConversationMessages() || [];
    const botTurn = lastBotTurn(messages);
    const actual = botTurn?.text || "";
    const evaluation = evaluateBotResponse({ actual, expected: step.expected, match });
    const result = {
      index,
      utterance: step.utterance,
      expected: step.expected,
      actual,
      pass: evaluation.pass,
      reason: evaluation.reason,
    };
    results.push(result);
    onStepComplete?.(result);

    if (stepDelayMs > 0 && index < steps.length - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, stepDelayMs));
    }
  }

  const passed = results.filter((entry) => entry.pass).length;
  return {
    results,
    summary: `${passed}/${results.length} step(s) passed.`,
    allPassed: passed === results.length,
  };
};

export { runConversationAutomation, parseAutomationSteps, waitFor };
