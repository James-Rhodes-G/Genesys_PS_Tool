import assert from "node:assert/strict";
import { lastBotTurn, parseAutomationSteps } from "../public/js/chat-agent-transcript.js";
import { evaluateBotResponse } from "../public/js/chat-agent-response-eval.js";

assert.deepEqual(parseAutomationSteps("hello\nworld | goodbye"), [
  { utterance: "hello", expected: "" },
  { utterance: "world", expected: "goodbye" },
]);

assert.deepEqual(parseAutomationSteps("  \n# not a comment — still utterance\n"), [
  { utterance: "# not a comment — still utterance", expected: "" },
]);

assert.equal(
  lastBotTurn([
    { role: "customer", text: "hi" },
    { role: "bot", text: "Hello" },
    { role: "customer", text: "bye" },
  ])?.text,
  "Hello"
);

assert.equal(
  evaluateBotResponse({ actual: "Your order is ready", expected: "order", match: "contains" }).pass,
  true
);
assert.equal(
  evaluateBotResponse({ actual: "ok", expected: "^nope$", match: "regex" }).pass,
  false
);
assert.equal(evaluateBotResponse({ actual: "", expected: "" }).pass, false);
assert.equal(evaluateBotResponse({ actual: "hi", expected: "" }).pass, true);

console.log("test-chat-agent-automation.mjs passed");