import assert from "node:assert/strict";
import {
  ELIGIBILITY,
  getFlowTypeDefinition,
  mapConsumingResourceTypeToFlowTypeKey,
  normalizeFlowTypeKey,
  resolveDependencyObjectType,
} from "../src/lib/flow-dependency-types.js";
import {
  buildArchitectFlowUrl,
  buildFlowDependencyResult,
  collectDependencyVersions,
  compareVersionLabels,
  groupConsumingResources,
  orderDependencyResults,
} from "../src/lib/flow-dependency.js";

assert.equal(normalizeFlowTypeKey("commonmodule"), "commonmodule");
assert.equal(getFlowTypeDefinition("inbound")?.dependencyObjectType, "INBOUNDCALLFLOW");
assert.equal(resolveDependencyObjectType("INBOUNDCALL"), "INBOUNDCALLFLOW");
assert.equal(mapConsumingResourceTypeToFlowTypeKey("INBOUNDCALLFLOW"), "inbound");

const sampleEntities = [
  { id: "flow-1", name: "Template #1", version: "2.0", type: "INBOUNDCALLFLOW" },
  { id: "flow-1", name: "Template #1", version: "1.0", type: "INBOUNDCALLFLOW" },
  { id: "flow-2", name: "Template #3", version: "11.0", type: "INBOUNDCALLFLOW" },
  { id: "flow-2", name: "Template #3", version: "10.0", type: "INBOUNDCALLFLOW" },
];

const groups = groupConsumingResources(sampleEntities);
assert.equal(groups.length, 2);
assert.deepEqual(collectDependencyVersions(groups[0]), ["2.0", "1.0"]);

const publishedResult = buildFlowDependencyResult({
  group: groups[0],
  flowDetail: { publishedVersion: { id: "2.0" }, version: { id: "2.0" } },
  appDomain: "mypurecloud.com",
});

assert.equal(publishedResult.activeDependency, true);
assert.equal(publishedResult.eligibility, ELIGIBILITY.ELIGIBLE);
assert.equal(publishedResult.versionDetails.length, 2);
assert.equal(publishedResult.versionDetails[0].state, "Published");
assert.equal(publishedResult.versionDetails[1].state, "Historical");

const historicalResult = buildFlowDependencyResult({
  group: groups[0],
  flowDetail: { publishedVersion: { id: "3.0" }, version: { id: "3.0" } },
  appDomain: "mypurecloud.com",
});

assert.equal(historicalResult.activeDependency, false);
assert.equal(historicalResult.eligibility, ELIGIBILITY.HISTORICAL_DEPENDENCY_ONLY);
assert.equal(historicalResult.versionDetails.every((entry) => entry.hasDependency), true);

const newerResult = buildFlowDependencyResult({
  group: groups[1],
  flowDetail: { publishedVersion: { id: "10.0" }, version: { id: "12.0" } },
  appDomain: "mypurecloud.com",
});

assert.equal(newerResult.activeDependency, true);
assert.equal(newerResult.eligibility, ELIGIBILITY.NEWER_VERSION_EXISTS);
assert.ok(newerResult.newerUnpublishedVersions.some((entry) => entry.versionId === "11.0"));

const ordered = orderDependencyResults([
  { flowName: "Zeta", activeDependency: false, eligibility: ELIGIBILITY.HISTORICAL_DEPENDENCY_ONLY },
  { flowName: "Alpha", activeDependency: true, eligibility: ELIGIBILITY.ELIGIBLE },
]);

assert.deepEqual(
  ordered.active.map((entry) => entry.flowName),
  ["Alpha"]
);
assert.deepEqual(
  ordered.inactive.map((entry) => entry.flowName),
  ["Zeta"]
);

assert.equal(
  buildArchitectFlowUrl({ appDomain: "mypurecloud.com", flowId: "flow-123" }),
  "https://apps.mypurecloud.com/architect/#/flows/flow-123"
);

console.log("flow-dependency tests passed");
