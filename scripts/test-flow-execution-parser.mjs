import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseExecutionJson, normalizeVariableEntry } from "../src/lib/flow-execution-parser.js";
import {
  buildExpandedTrackingIds,
  findErrorTargets,
  findSearchMatches,
  getTrackedVariableDisplay,
  getFinalVariableStates,
} from "../src/lib/flow-execution-analysis.js";
import { resolveActionTypeMetadata } from "../src/lib/flow-execution-action-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePath = path.resolve(__dirname, "fixtures/flow-execution-sample.json");
const sample = JSON.parse(await readFile(samplePath, "utf8"));

const model = parseExecutionJson(sample, {
  conversationId: "conversation-123",
  instanceId: "flow-instance-1",
  flowName: "Customer Lookup",
  flowType: "INBOUNDCALL",
  flowVersion: "2.0",
});

assert.equal(model.summary.actionsExecuted, 8);
assert.equal(model.flatNodes[0].trackingId, 1);
assert.equal(model.flatNodes[model.flatNodes.length - 1].trackingId, 8);
assert.ok(model.flatNodes[0].flatIndex < model.flatNodes[1].flatIndex, "flat nodes stay chronological");

const moduleNode = model.nodes.find((node) => node.actionName === "Schedule Check");
assert.ok(moduleNode?.isGroup);
assert.equal(moduleNode.children.length, 2);
assert.equal(moduleNode.children[0].trackingId, 3);

assert.equal(resolveActionTypeMetadata("actionDecision").label, "Decision");
assert.equal(resolveActionTypeMetadata("actionMadeUpThing").tone, "unknown");

const customerFound = model.flatNodes.find((node) => node.actionName === "Customer Found?");
assert.equal(customerFound.variables["Flow.found"].displayValue, "true");

const lookupCustomer = model.flatNodes.find((node) => node.actionName === "Lookup Customer");
assert.equal(lookupCustomer.variables["Flow.secretToken"].state, "tooLarge");
assert.equal(lookupCustomer.variables["Flow.redactedField"].state, "redacted");

const valueIsRedactedEntry = normalizeVariableEntry({ valueIsRedacted: true, value: "secret-audio" });
assert.equal(valueIsRedactedEntry.state, "redacted");
assert.equal(valueIsRedactedEntry.displayValue, "[Redacted]");

const changedNode = model.flatNodes.find((node) => node.actionName === "Set Customer ID");
assert.ok(changedNode.changedVariables["Flow.customerId"]);

const tracked = getTrackedVariableDisplay(changedNode, ["Flow.customerId"], "tracked", model);
assert.equal(tracked.length, 1);
assert.equal(tracked[0].current.displayValue, changedNode.variables["Flow.customerId"].displayValue);

assert.ok(model.variableHistory, "variable history should be built");
assert.ok(
  model.variableHistory["Flow.customerId"]?.some((entry) => entry.actionId === "sv-1"),
  "variable history should record action ids"
);
assert.equal(
  model.variableStateByFlatIndex[customerFound.flatIndex]["Flow.found"].displayValue,
  "true"
);

const finalStates = getFinalVariableStates(model);
assert.equal(finalStates.length, model.variableIndex.length);
assert.equal(finalStates.find((entry) => entry.name === "Flow.found")?.current.displayValue, "true");

const namedObject = normalizeVariableEntry({ id: "92a904b1-7bde-498f-ab9f-9c30ec4aa0d8", name: "Schedule_Open" });
assert.equal(namedObject.displayValue, "Schedule_Open");

const namedObjectMap = normalizeVariableEntry({
  flowMilestone: { id: "92a904b1-7bde-498f-ab9f-9c30ec4aa0d8", name: "Schedule_Open" },
  flowOutcome: { id: "2052e8a5-90ec-458b-9031-e52abf98d856", name: "Call_Processing" },
});
assert.equal(namedObjectMap.displayValue, "flowMilestone: Schedule_Open\nflowOutcome: Call_Processing");

const cumulativeAtCustomerFound = getTrackedVariableDisplay(
  customerFound,
  ["Flow.customerId", "Flow.found"],
  "tracked",
  model
);
assert.equal(cumulativeAtCustomerFound.find((entry) => entry.name === "Flow.customerId")?.current.displayValue, "cust-001");
assert.ok(customerFound.changedVariables["Flow.found"]);
assert.equal(cumulativeAtCustomerFound.find((entry) => entry.name === "Flow.found")?.changed, true);

const errors = findErrorTargets(model);
assert.equal(errors.length, 1);
assert.equal(errors[0].actionName, "Transfer to Support");

const searchMatches = findSearchMatches(model, "decision");
assert.ok(searchMatches.some((match) => match.actionName === "Customer Found?"));

const expanded = buildExpandedTrackingIds(model, { searchQuery: "Open Now?" });
assert.ok(expanded.has(moduleNode.trackingId));

const largeActions = Array.from({ length: 250 }, (_, index) => ({
  trackingId: index + 1,
  actionType: "actionDecision",
  actionName: `Decision ${index + 1}`,
  timestamp: `2026-08-10T14:50:${String(index % 60).padStart(2, "0")}.000Z`,
  variables: { [`Flow.var${index}`]: { value: index } },
}));

const largeModel = parseExecutionJson({ execution: { actions: largeActions } });
assert.equal(largeModel.flatNodes.length, 250);
assert.equal(largeModel.variableIndex.length, 250);

const genesysRenderedPath = path.resolve(__dirname, "fixtures/flow-execution-genesys-rendered.json");
const genesysRendered = JSON.parse(await readFile(genesysRenderedPath, "utf8"));
const genesysModel = parseExecutionJson(genesysRendered, {
  conversationId: "conversation-123",
  instanceId: "5a6b3e67-b0ad-4e86-85e0-fc3fac9f11c9",
});
assert.equal(genesysModel.summary.actionsExecuted, 2);
assert.ok(genesysModel.meta.actionRootPath?.includes("executionHistory"));

const genesysRealPath = path.resolve(__dirname, "fixtures/flow-execution-genesys-real.json");
const genesysReal = JSON.parse(await readFile(genesysRealPath, "utf8"));
const genesysRealModel = parseExecutionJson(genesysReal, {
  conversationId: genesysReal.flow.conversationId,
  instanceId: genesysReal.flow.executionId,
  flowName: genesysReal.flow.flowName,
});
assert.ok(genesysRealModel.summary.actionsExecuted > 100, "real Genesys rendered document should parse many actions");
assert.equal(genesysRealModel.summary.flowName, "Template #3");
assert.ok(genesysRealModel.meta.actionRootPath?.includes("execution.actions"));
assert.ok(
  genesysRealModel.flatNodes.some((node) => node.actionType === "actionCallCommonModule"),
  "common module actions should be present"
);
assert.ok(
  genesysRealModel.nodes.some((node) => node.children?.length),
  "nested common module execution should produce child nodes"
);

console.log("flow-execution parser tests passed");
