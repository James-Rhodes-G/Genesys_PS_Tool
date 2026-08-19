import assert from "node:assert/strict";
import {
  buildFlowValidationBody,
  incrementVersionLabel,
  pickCheckoutVersionId,
  pickPublishOperationId,
  resolveNextPublishVersionLabel,
  resolvePublishVersionFromCheckout,
  resolveSourceModule,
  validatePublishedVersionAdvance,
} from "../src/lib/flow-republish.js";

const buildCheckoutPath = (flowId) => {
  const query = new URLSearchParams({ flow: String(flowId || "").trim() });
  return `/api/v2/flows/actions/checkout?${query.toString()}`;
};

const buildPublishPath = (flowId, versionLabel = "") => {
  const query = new URLSearchParams({
    flow: String(flowId || "").trim(),
  });
  if (versionLabel) {
    query.set("version", String(versionLabel).trim());
  }
  return `/api/v2/flows/actions/publish?${query.toString()}`;
};

assert.equal(
  buildCheckoutPath("ce677f29-f403-470c-adb0-8bfa6bf81d69"),
  "/api/v2/flows/actions/checkout?flow=ce677f29-f403-470c-adb0-8bfa6bf81d69"
);

assert.equal(
  buildPublishPath("ce677f29-f403-470c-adb0-8bfa6bf81d69"),
  "/api/v2/flows/actions/publish?flow=ce677f29-f403-470c-adb0-8bfa6bf81d69"
);

assert.equal(
  buildPublishPath("ce677f29-f403-470c-adb0-8bfa6bf81d69", "14.0"),
  "/api/v2/flows/actions/publish?flow=ce677f29-f403-470c-adb0-8bfa6bf81d69&version=14.0"
);

const checkoutResponse = {
  id: "5e91a5e0-4bfd-47b4-9d5d-9778ccd5e86a",
  publishedVersion: { id: "1.0", configurationVersion: "2.0" },
  savedVersion: {
    id: "saved_version_1b2834b7-dc20-4b7f-afea-aba28bf3d5f9",
    configurationVersion: "1.0",
  },
  currentOperation: {
    actionName: "CHECKOUT",
    actionStatus: "SUCCESS",
  },
};

assert.equal(
  pickCheckoutVersionId(checkoutResponse),
  "saved_version_1b2834b7-dc20-4b7f-afea-aba28bf3d5f9"
);

assert.deepEqual(resolvePublishVersionFromCheckout(checkoutResponse), {
  publishedVersionBeforeRepublish: "1.0",
  publishVersionId: "2.0",
});

assert.equal(resolveNextPublishVersionLabel("13.0"), "14.0");
assert.equal(resolveNextPublishVersionLabel("6.0"), "7.0");

assert.deepEqual(
  validatePublishedVersionAdvance({
    publishedVersionBeforeRepublish: "13.0",
    observedPublishedVersionId: "14.0",
  }),
  {
    ok: true,
    error: "",
    observedPublishedVersionId: "14.0",
    expectedPublishedVersionId: "14.0",
    publishedVersionAfterRepublish: "14.0",
  }
);

assert.equal(
  validatePublishedVersionAdvance({
    publishedVersionBeforeRepublish: "13.0",
    observedPublishedVersionId: "15.0",
  }).error,
  "Publish skipped versions: v13.0 -> v15.0 (expected v14.0)."
);

assert.deepEqual(buildFlowValidationBody({ id: "4c20bb7e-4583-473a-b550-4546d281eeb9", name: "Menu" }), {
  commonModuleFlow: [
    {
      name: "Menu",
      id: "4c20bb7e-4583-473a-b550-4546d281eeb9",
      version: "published",
    },
  ],
});

assert.deepEqual(
  resolveSourceModule({
    selectedFlowId: "4c20bb7e-4583-473a-b550-4546d281eeb9",
    selectedFlowName: "Menu",
  }),
  {
    id: "4c20bb7e-4583-473a-b550-4546d281eeb9",
    name: "Menu",
    version: "published",
  }
);

assert.equal(
  pickPublishOperationId({
    id: "cc4533ab-69fb-49a3-8f90-4b3cc70ca5f6",
    complete: false,
    actionName: "PUBLISH",
    actionStatus: "STARTED",
  }),
  "cc4533ab-69fb-49a3-8f90-4b3cc70ca5f6"
);

assert.equal(incrementVersionLabel("4.0"), "5.0");
assert.equal(incrementVersionLabel("13.0"), "14.0");

console.log("flow-republish helper tests passed");
