import { genesysRequest } from "./genesys.js";
import { getFlowTypeDefinition } from "./flow-dependency-types.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const REPUBLISH_STAGES = ["checkout", "validate", "publish", "complete"];

const pickCheckoutVersionId = (payload) =>
  String(
    payload?.savedVersion?.id ||
      payload?.version?.id ||
      payload?.output?.savedVersion?.id ||
      payload?.output?.flowVersion?.id ||
      payload?.output?.version?.id ||
      payload?.flowVersion?.id ||
      payload?.flow?.savedVersion?.id ||
      payload?.flow?.version?.id ||
      ""
  ).trim();

const isCheckoutSuccessful = (payload) => {
  const operation = payload?.currentOperation;
  if (!operation) {
    return true;
  }

  const actionName = String(operation.actionName || "").toUpperCase();
  const actionStatus = String(operation.actionStatus || "").toUpperCase();
  if (actionName && actionName !== "CHECKOUT") {
    return true;
  }

  return actionStatus === "SUCCESS";
};

const formatCheckoutFailure = (payload) => {
  const details = payload?.currentOperation?.errorDetails;
  if (Array.isArray(details) && details.length) {
    return details
      .map((entry) => entry?.message || entry?.text || JSON.stringify(entry))
      .filter(Boolean)
      .join("; ");
  }

  return payload?.currentOperation?.actionStatus || payload?.message || "Flow checkout failed.";
};

const pickValidationJobId = (payload) => String(payload?.id || payload?.validationJobId || "").trim();

const pickPublishOperationId = (payload) =>
  String(payload?.id || payload?.publishOperationId || payload?.operationId || "").trim();

const looksLikeSavedVersionToken = (value) =>
  String(value || "").trim().toLowerCase().startsWith("saved_version_");

const isPublishableVersionLabel = (value) => {
  const normalized = String(value || "").trim();
  return Boolean(normalized && !looksLikeSavedVersionToken(normalized));
};

const incrementVersionLabel = (versionLabel) => {
  const normalized = String(versionLabel || "").trim();
  if (!isPublishableVersionLabel(normalized)) {
    return "";
  }

  const parts = normalized.split(".");
  const major = Number(parts[0]);
  if (!Number.isFinite(major)) {
    return "";
  }

  const minor = parts.length > 1 ? Number(parts[1]) : 0;
  if (parts.length > 1 && !Number.isFinite(minor)) {
    return "";
  }

  return `${major + 1}.${minor}`;
};

const pickCheckoutPublishedVersionId = (payload) =>
  String(
    payload?.publishedVersion?.id ||
      payload?.checkedInVersion?.id ||
      payload?.output?.publishedVersion?.id ||
      payload?.flow?.publishedVersion?.id ||
      ""
  ).trim();

const compareVersionLabels = (left, right) => {
  const leftLabel = String(left ?? "").trim();
  const rightLabel = String(right ?? "").trim();
  if (!leftLabel || !rightLabel) {
    return 0;
  }

  const leftNumber = Number(leftLabel);
  const rightNumber = Number(rightLabel);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return leftLabel.localeCompare(rightLabel, undefined, { numeric: true, sensitivity: "base" });
};

const resolveNextPublishVersionLabel = (publishedVersionBeforeRepublish) =>
  incrementVersionLabel(publishedVersionBeforeRepublish);

const resolvePublishVersionFromCheckout = (checkoutPayload) => {
  const publishedVersionBeforeRepublish = pickCheckoutPublishedVersionId(checkoutPayload);
  if (!publishedVersionBeforeRepublish) {
    return { publishedVersionBeforeRepublish: "", publishVersionId: "" };
  }

  return {
    publishedVersionBeforeRepublish,
    publishVersionId: resolveNextPublishVersionLabel(publishedVersionBeforeRepublish),
  };
};

const validatePublishedVersionAdvance = ({ observedPublishedVersionId, publishedVersionBeforeRepublish }) => {
  const observed = String(observedPublishedVersionId || "").trim();
  const before = String(publishedVersionBeforeRepublish || "").trim();
  const expected = resolveNextPublishVersionLabel(before);

  if (!observed) {
    return { ok: false, error: "Publish completed but no published version was returned." };
  }

  if (!before || compareVersionLabels(observed, before) <= 0) {
    return {
      ok: false,
      error: `Publish did not advance beyond v${before || "—"}.`,
      observedPublishedVersionId: observed,
      expectedPublishedVersionId: expected,
    };
  }

  if (expected && compareVersionLabels(observed, expected) > 0) {
    return {
      ok: false,
      error: `Publish skipped versions: v${before} -> v${observed} (expected v${expected}).`,
      observedPublishedVersionId: observed,
      expectedPublishedVersionId: expected,
    };
  }

  return {
    ok: true,
    error: "",
    observedPublishedVersionId: observed,
    expectedPublishedVersionId: expected,
    publishedVersionAfterRepublish: observed,
  };
};

const isFlowPublishComplete = (
  flowDetail,
  { publishOperationId, expectedPublishedVersionId, publishedVersionBeforeRepublish }
) => {
  const operation = flowDetail?.currentOperation;
  const actionName = String(operation?.actionName || "").toUpperCase();
  const operationId = String(operation?.id || "").trim();
  const matchesOperation = !publishOperationId || operationId === publishOperationId;

  if (matchesOperation && actionName === "PUBLISH" && operation?.complete) {
    if (isPublishOperationComplete(operation)) {
      return true;
    }
    if (isPublishOperationFailed(operation)) {
      return "failed";
    }
  }

  const currentPublished = pickObservedPublishedVersionId(flowDetail);
  if (expectedPublishedVersionId && currentPublished === expectedPublishedVersionId) {
    return true;
  }

  const expectedFromBefore = resolveNextPublishVersionLabel(publishedVersionBeforeRepublish);
  if (expectedFromBefore && currentPublished === expectedFromBefore) {
    return true;
  }

  return false;
};

const pickObservedPublishedVersionId = (flowDetail) =>
  String(flowDetail?.publishedVersion?.id || "").trim();

const isValidationComplete = (payload) =>
  Boolean(payload?.complete) && String(payload?.actionStatus || "").toUpperCase() === "SUCCESS";

const isValidationFailed = (payload) => {
  const status = String(payload?.actionStatus || payload?.status || "").toUpperCase();
  return Boolean(payload?.complete) && status && status !== "SUCCESS";
};

const isPublishOperationComplete = isValidationComplete;
const isPublishOperationFailed = isValidationFailed;

const formatValidationFailure = (payload) => {
  const messages = payload?.results?.messages || payload?.messages || payload?.results;
  if (Array.isArray(messages) && messages.length) {
    return messages
      .map((entry) => entry?.message || entry?.text || JSON.stringify(entry))
      .filter(Boolean)
      .join("; ");
  }

  if (messages && typeof messages === "object") {
    return JSON.stringify(messages);
  }

  return payload?.error || payload?.message || "Flow validation failed.";
};

const formatPublishFailure = (payload) => {
  const details = payload?.errorDetails;
  if (Array.isArray(details) && details.length) {
    return details
      .map((entry) => entry?.message || entry?.text || JSON.stringify(entry))
      .filter(Boolean)
      .join("; ");
  }

  const messages = payload?.messages || payload?.results?.messages;
  if (Array.isArray(messages) && messages.length) {
    return messages
      .map((entry) => entry?.message || entry?.text || JSON.stringify(entry))
      .filter(Boolean)
      .join("; ");
  }

  return payload?.error || payload?.message || payload?.actionStatus || "Flow publish failed.";
};

const fetchFlowDetail = async ({ region, token, flowId }) =>
  genesysRequest({
    region,
    token,
    path: `/api/v2/flows/${encodeURIComponent(flowId)}`,
  });

const normalizeSourceModule = (sourceModule) => {
  const id = String(sourceModule?.id || "").trim();
  const name = String(sourceModule?.name || "").trim();
  if (!id) {
    return null;
  }

  return {
    id,
    name: name || id,
    version: String(sourceModule?.version || "published").trim() || "published",
  };
};

const resolveSourceModule = (input = {}) => {
  const candidates = [
    input?.sourceModule,
    {
      id: input?.sourceModuleId || input?.selectedFlowId,
      name: input?.sourceModuleName || input?.selectedFlowName,
      version: input?.sourceModuleVersion,
    },
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSourceModule(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const buildFlowValidationBody = (sourceModule) => {
  const moduleRef = resolveSourceModule({ sourceModule });
  if (!moduleRef) {
    return null;
  }

  return {
    commonModuleFlow: [
      {
        name: moduleRef.name,
        id: moduleRef.id,
        version: moduleRef.version,
      },
    ],
  };
};

const checkoutFlow = async ({ region, token, flowId }) => {
  const normalizedFlowId = String(flowId || "").trim();
  if (!normalizedFlowId) {
    throw new Error("flowId is required for checkout.");
  }

  const query = new URLSearchParams({ flow: normalizedFlowId });
  const payload = await genesysRequest({
    region,
    token,
    method: "POST",
    path: `/api/v2/flows/actions/checkout?${query.toString()}`,
  });

  if (!isCheckoutSuccessful(payload)) {
    throw new Error(formatCheckoutFailure(payload));
  }

  const checkedOutVersionId = pickCheckoutVersionId(payload);
  if (!checkedOutVersionId) {
    throw new Error("Checkout succeeded but no working version ID was returned.");
  }

  const { publishedVersionBeforeRepublish, publishVersionId } = resolvePublishVersionFromCheckout(payload);
  if (!publishedVersionBeforeRepublish || !publishVersionId) {
    throw new Error("Checkout succeeded but no expected publish version could be determined.");
  }

  return {
    checkedOutVersionId,
    publishedVersionBeforeRepublish,
    publishVersionId,
    raw: payload,
  };
};

const startFlowValidation = async ({ region, token, flowId, flowTypeKey, sourceModule }) => {
  const definition = getFlowTypeDefinition(flowTypeKey);
  if (!definition) {
    throw new Error("A valid flow type is required for validation.");
  }

  const resolvedSourceModule = resolveSourceModule({ sourceModule });
  const validationBody = buildFlowValidationBody(resolvedSourceModule);
  if (!validationBody) {
    throw new Error("A source Common Module is required for validation.");
  }

  const query = new URLSearchParams({
    flow: String(flowId || "").trim(),
    flowType: definition.validateFlowType,
  });

  const payload = await genesysRequest({
    region,
    token,
    method: "POST",
    path: `/api/v2/flows/actions/validate?${query.toString()}`,
    body: validationBody,
  });

  const validationJobId = pickValidationJobId(payload);
  if (!validationJobId) {
    throw new Error("Validation request did not return a job ID.");
  }

  return {
    validationJobId,
    raw: payload,
  };
};

const pollFlowValidation = async ({
  region,
  token,
  flowId,
  validationJobId,
  maxAttempts = 60,
  intervalMs = 2000,
}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const payload = await genesysRequest({
      region,
      token,
      path: `/api/v2/flows/${encodeURIComponent(flowId)}/validate/${encodeURIComponent(validationJobId)}`,
    });

    if (isValidationComplete(payload)) {
      return { status: "success", payload };
    }

    if (isValidationFailed(payload)) {
      return {
        status: "failed",
        error: formatValidationFailure(payload),
        payload,
      };
    }

    await wait(intervalMs);
  }

  return {
    status: "failed",
    error: "Timed out waiting for flow validation to complete.",
    payload: null,
  };
};

const startFlowPublish = async ({ region, token, flowId, versionId }) => {
  const normalizedFlowId = String(flowId || "").trim();
  const normalizedVersionId = String(versionId || "").trim();
  if (!normalizedFlowId) {
    throw new Error("flowId is required for publish.");
  }

  const query = new URLSearchParams({ flow: normalizedFlowId });
  if (normalizedVersionId) {
    query.set("version", normalizedVersionId);
  }

  const payload = await genesysRequest({
    region,
    token,
    method: "POST",
    path: `/api/v2/flows/actions/publish?${query.toString()}`,
  });

  const publishOperationId = pickPublishOperationId(payload);
  if (!publishOperationId) {
    throw new Error("Publish request did not return an operation ID.");
  }

  return {
    publishOperationId,
    raw: payload,
  };
};

const publishFlowVersionLabel = async ({
  region,
  token,
  flowId,
  publishedVersionBeforeRepublish,
  maxPublishAttempts = 90,
  pollIntervalMs = 2000,
}) => {
  const normalizedPublishedBefore = String(publishedVersionBeforeRepublish || "").trim();
  const expectedPublishedVersionId = resolveNextPublishVersionLabel(normalizedPublishedBefore);

  if (!normalizedPublishedBefore || !expectedPublishedVersionId) {
    return {
      status: "failed",
      error: "The published version before republish is required.",
      observedPublishedVersionId: "",
      publishedVersionAfterRepublish: "",
      publishVersionId: "",
      payload: null,
    };
  }

  const publishStart = await startFlowPublish({
    region,
    token,
    flowId,
  });
  const publish = await pollFlowPublish({
    region,
    token,
    flowId,
    publishOperationId: publishStart.publishOperationId,
    expectedPublishedVersionId,
    publishedVersionBeforeRepublish: normalizedPublishedBefore,
    maxAttempts: maxPublishAttempts,
    intervalMs: pollIntervalMs,
  });

  if (publish.status !== "success") {
    return {
      status: "failed",
      error: publish.error,
      observedPublishedVersionId: "",
      publishedVersionAfterRepublish: "",
      publishVersionId: expectedPublishedVersionId,
      payload: publish.payload,
    };
  }

  const observedPublishedVersionId = pickObservedPublishedVersionId(publish.payload);
  const validation = validatePublishedVersionAdvance({
    observedPublishedVersionId,
    publishedVersionBeforeRepublish: normalizedPublishedBefore,
  });

  if (!validation.ok) {
    return {
      status: "failed",
      error: validation.error,
      observedPublishedVersionId: validation.observedPublishedVersionId || observedPublishedVersionId,
      publishedVersionAfterRepublish: "",
      publishVersionId: expectedPublishedVersionId,
      payload: publish.payload,
    };
  }

  return {
    status: "success",
    error: "",
    observedPublishedVersionId: validation.observedPublishedVersionId,
    publishedVersionAfterRepublish: validation.publishedVersionAfterRepublish,
    publishVersionId: expectedPublishedVersionId,
    payload: publish.payload,
  };
};

const pollFlowPublish = async ({
  region,
  token,
  flowId,
  publishOperationId,
  expectedPublishedVersionId,
  publishedVersionBeforeRepublish,
  maxAttempts = 90,
  intervalMs = 2000,
}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const flowDetail = await fetchFlowDetail({ region, token, flowId });
    const completion = isFlowPublishComplete(flowDetail, {
      publishOperationId,
      expectedPublishedVersionId,
      publishedVersionBeforeRepublish,
    });

    if (completion === true) {
      return { status: "success", payload: flowDetail };
    }

    if (completion === "failed") {
      return {
        status: "failed",
        error: formatPublishFailure(flowDetail?.currentOperation || flowDetail),
        payload: flowDetail,
      };
    }

    await wait(intervalMs);
  }

  return {
    status: "failed",
    error: "Timed out waiting for flow publish to complete.",
    payload: null,
  };
};

const republishFlow = async ({
  region,
  token,
  flowId,
  flowTypeKey,
  sourceModule,
  onStage,
  maxValidationAttempts,
  maxPublishAttempts,
  pollIntervalMs,
}) => {
  const stages = {
    checkout: { status: "pending", error: "" },
    validate: { status: "pending", error: "", validationResults: null },
    publish: { status: "pending", error: "" },
    complete: { status: "pending", error: "" },
  };

  const reportStage = (stage, patch) => {
    stages[stage] = { ...stages[stage], ...patch };
    onStage?.({ stage, stages: { ...stages } });
  };

  const resolvedSourceModule = resolveSourceModule({ sourceModule });
  if (!resolvedSourceModule) {
    throw new Error("A source Common Module is required for validation.");
  }

  try {
    reportStage("checkout", { status: "running" });
    const checkout = await checkoutFlow({ region, token, flowId });
    const { publishedVersionBeforeRepublish, publishVersionId } = checkout;
    reportStage("checkout", {
      status: "success",
      checkedOutVersionId: checkout.checkedOutVersionId,
      publishedVersionBeforeRepublish,
      publishVersionId,
    });

    reportStage("validate", { status: "running" });
    const validationStart = await startFlowValidation({
      region,
      token,
      flowId,
      flowTypeKey,
      sourceModule: resolvedSourceModule,
    });
    const validation = await pollFlowValidation({
      region,
      token,
      flowId,
      validationJobId: validationStart.validationJobId,
      maxAttempts: maxValidationAttempts,
      intervalMs: pollIntervalMs,
    });

    if (validation.status !== "success") {
      reportStage("validate", {
        status: "failed",
        error: validation.error,
        validationResults: validation.payload,
      });
      reportStage("complete", { status: "failed", error: "" });
      return {
        status: "failed",
        stages,
        checkedOutVersionId: checkout.checkedOutVersionId,
        publishedVersionBeforeRepublish,
        publishVersionId: "",
        publishedVersionAfterRepublish: "",
        observedPublishedVersionId: "",
        error: validation.error,
      };
    }

    reportStage("validate", {
      status: "success",
      validationResults: validation.payload,
    });

    reportStage("publish", {
      status: "running",
      publishedVersionBeforeRepublish,
      publishVersionId,
    });

    const publish = await publishFlowVersionLabel({
      region,
      token,
      flowId,
      publishedVersionBeforeRepublish,
      maxPublishAttempts,
      pollIntervalMs,
    });

    if (publish.status !== "success") {
      reportStage("publish", {
        status: "failed",
        error: publish.error,
        observedPublishedVersionId: publish.observedPublishedVersionId || "",
      });
      reportStage("complete", { status: "failed", error: "" });
      return {
        status: "failed",
        stages,
        checkedOutVersionId: checkout.checkedOutVersionId,
        publishedVersionBeforeRepublish,
        publishVersionId,
        publishedVersionAfterRepublish: "",
        observedPublishedVersionId: publish.observedPublishedVersionId || "",
        error: publish.error,
      };
    }

    const { observedPublishedVersionId, publishedVersionAfterRepublish } = publish;

    reportStage("publish", {
      status: "success",
      publishedVersionBeforeRepublish,
      publishVersionId,
      publishedVersionAfterRepublish,
      observedPublishedVersionId,
    });
    reportStage("complete", { status: "success" });

    return {
      status: "success",
      stages,
      checkedOutVersionId: checkout.checkedOutVersionId,
      publishedVersionBeforeRepublish,
      publishVersionId,
      publishedVersionAfterRepublish,
      observedPublishedVersionId,
      error: "",
    };
  } catch (error) {
    const activeStage = Object.entries(stages).find(([, value]) => value.status === "running")?.[0] || "checkout";
    reportStage(activeStage, { status: "failed", error: error.message });
    reportStage("complete", { status: "failed", error: error.message });
    return {
      status: "failed",
      stages,
      checkedOutVersionId: stages.checkout.checkedOutVersionId || "",
      publishedVersionBeforeRepublish: stages.checkout.publishedVersionBeforeRepublish || "",
      publishVersionId: stages.checkout.publishVersionId || stages.publish.publishVersionId || "",
      publishedVersionAfterRepublish: "",
      observedPublishedVersionId: "",
      error: error.message,
    };
  }
};

const republishFlowsBulk = async ({
  region,
  token,
  flows,
  sourceModule,
  onItemStage,
  onItemComplete,
  ...options
}) => {
  const results = [];

  for (const flow of flows) {
    onItemStage?.(flow, { stage: "checkout", stages: {} });
    const result = await republishFlow({
      region,
      token,
      flowId: flow.flowId,
      flowTypeKey: flow.flowTypeKey,
      sourceModule,
      onStage: (stageUpdate) => onItemStage?.(flow, stageUpdate),
      ...options,
    });

    const row = {
      flowId: flow.flowId,
      flowName: flow.flowName,
      flowTypeKey: flow.flowTypeKey,
      status: result.status,
      error: result.error,
      checkedOutVersionId: result.checkedOutVersionId,
      publishedVersionBeforeRepublish: result.publishedVersionBeforeRepublish,
      publishVersionId: result.publishVersionId,
      publishedVersionAfterRepublish: result.publishedVersionAfterRepublish,
      observedPublishedVersionId: result.observedPublishedVersionId,
      stages: result.stages,
    };

    results.push(row);
    onItemComplete?.(row);
  }

  return results;
};

export {
  REPUBLISH_STAGES,
  buildFlowValidationBody,
  checkoutFlow,
  formatCheckoutFailure,
  formatPublishFailure,
  formatValidationFailure,
  isCheckoutSuccessful,
  isPublishOperationComplete,
  isPublishOperationFailed,
  isValidationComplete,
  isValidationFailed,
  normalizeSourceModule,
  pickCheckoutPublishedVersionId,
  pickCheckoutVersionId,
  pickObservedPublishedVersionId,
  pickPublishOperationId,
  compareVersionLabels,
  incrementVersionLabel,
  pickValidationJobId,
  pollFlowPublish,
  pollFlowValidation,
  publishFlowVersionLabel,
  republishFlow,
  republishFlowsBulk,
  resolveNextPublishVersionLabel,
  resolvePublishVersionFromCheckout,
  resolveSourceModule,
  startFlowPublish,
  startFlowValidation,
  validatePublishedVersionAdvance,
};
