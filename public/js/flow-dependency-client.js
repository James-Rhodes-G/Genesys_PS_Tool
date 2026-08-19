const buildHeaders = ({ region, token }) => ({
  "Content-Type": "application/json",
  "x-genesys-region": region,
  "x-genesys-token": token,
});

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const prefix = payload.source === "genesys" ? "Genesys API error: " : "";
    throw new Error(prefix + (payload.error || `Request failed (${response.status}).`));
  }
  return payload;
};

const createInitialRepublishStages = () => ({
  checkout: { status: "pending", error: "" },
  validate: { status: "pending", error: "", validationResults: null },
  publish: { status: "pending", error: "" },
  complete: { status: "pending", error: "" },
});

const postRepublishStage = async ({ region, token, stage, body }) => {
  const response = await fetch(`/api/genesys/architect/flow-republish/${stage}`, {
    method: "POST",
    headers: buildHeaders({ region, token }),
    body: JSON.stringify(body),
  });
  return parseResponse(response);
};

export const listArchitectFlowsByType = async ({ region, token, flowTypeKey }) => {
  const query = new URLSearchParams({ flowTypeKey: String(flowTypeKey || "") });
  const response = await fetch(`/api/genesys/architect/flows-by-type?${query.toString()}`, {
    method: "GET",
    headers: buildHeaders({ region, token }),
  });
  const payload = await parseResponse(response);
  return payload.flows || [];
};

export const discoverFlowDependencies = async ({
  region,
  token,
  selectedFlowId,
  sourceFlowTypeKey,
  appDomain,
}) => {
  const response = await fetch("/api/genesys/architect/dependency-search", {
    method: "POST",
    headers: buildHeaders({ region, token }),
    body: JSON.stringify({ selectedFlowId, sourceFlowTypeKey, appDomain }),
  });
  return parseResponse(response);
};

export const republishFlow = async ({ region, token, onStage, ...republishRequest }) => {
  const stages = createInitialRepublishStages();
  const reportStages = () => onStage?.({ stages: { ...stages } });

  const fail = (stage, error, extra = {}) => {
    stages[stage] = { ...stages[stage], status: "failed", error };
    stages.complete = { status: "failed", error: "" };
    reportStages();
    return {
      status: "failed",
      stages,
      error,
      checkedOutVersionId: stages.checkout.checkedOutVersionId || "",
      publishedVersionBeforeRepublish: stages.checkout.publishedVersionBeforeRepublish || "",
      publishVersionId: stages.checkout.publishVersionId || "",
      publishedVersionAfterRepublish: "",
      observedPublishedVersionId: stages.publish.observedPublishedVersionId || "",
      ...extra,
    };
  };

  stages.checkout.status = "running";
  reportStages();

  let checkout;
  try {
    checkout = await postRepublishStage({
      region,
      token,
      stage: "checkout",
      body: republishRequest,
    });
  } catch (error) {
    return fail("checkout", error.message);
  }

  stages.checkout = {
    status: "success",
    error: "",
    checkedOutVersionId: checkout.checkedOutVersionId,
    publishedVersionBeforeRepublish: checkout.publishedVersionBeforeRepublish,
    publishVersionId: checkout.publishVersionId,
  };
  stages.validate.status = "running";
  reportStages();

  try {
    const validation = await postRepublishStage({
      region,
      token,
      stage: "validate",
      body: republishRequest,
    });

    if (validation.status !== "success") {
      stages.validate = {
        status: "failed",
        error: validation.error || "Flow validation failed.",
        validationResults: validation.validationResults || null,
      };
      stages.complete = { status: "failed", error: "" };
      reportStages();
      return {
        status: "failed",
        stages,
        error: validation.error || "Flow validation failed.",
        checkedOutVersionId: checkout.checkedOutVersionId,
        publishedVersionBeforeRepublish: checkout.publishedVersionBeforeRepublish,
        publishVersionId: checkout.publishVersionId,
        publishedVersionAfterRepublish: "",
        observedPublishedVersionId: "",
      };
    }

    stages.validate = {
      status: "success",
      error: "",
      validationResults: validation.validationResults || null,
    };
  } catch (error) {
    return fail("validate", error.message, {
      checkedOutVersionId: checkout.checkedOutVersionId,
      publishedVersionBeforeRepublish: checkout.publishedVersionBeforeRepublish,
      publishVersionId: checkout.publishVersionId,
    });
  }

  stages.publish = {
    status: "running",
    error: "",
    publishedVersionBeforeRepublish: checkout.publishedVersionBeforeRepublish,
    publishVersionId: checkout.publishVersionId,
  };
  reportStages();

  try {
    const publish = await postRepublishStage({
      region,
      token,
      stage: "publish",
      body: {
        ...republishRequest,
        publishedVersionBeforeRepublish: checkout.publishedVersionBeforeRepublish,
      },
    });

    if (publish.status !== "success") {
      return fail("publish", publish.error || "Flow publish failed.", {
        checkedOutVersionId: checkout.checkedOutVersionId,
        publishedVersionBeforeRepublish: checkout.publishedVersionBeforeRepublish,
        publishVersionId: checkout.publishVersionId,
        observedPublishedVersionId: publish.observedPublishedVersionId || "",
      });
    }

    stages.publish = {
      status: "success",
      error: "",
      publishedVersionBeforeRepublish: checkout.publishedVersionBeforeRepublish,
      publishVersionId: checkout.publishVersionId,
      publishedVersionAfterRepublish: publish.publishedVersionAfterRepublish,
      observedPublishedVersionId: publish.observedPublishedVersionId,
    };
    stages.complete = { status: "success", error: "" };
    reportStages();

    return {
      status: "success",
      stages,
      error: "",
      checkedOutVersionId: checkout.checkedOutVersionId,
      publishedVersionBeforeRepublish: checkout.publishedVersionBeforeRepublish,
      publishVersionId: checkout.publishVersionId,
      publishedVersionAfterRepublish: publish.publishedVersionAfterRepublish,
      observedPublishedVersionId: publish.observedPublishedVersionId,
    };
  } catch (error) {
    return fail("publish", error.message, {
      checkedOutVersionId: checkout.checkedOutVersionId,
      publishedVersionBeforeRepublish: checkout.publishedVersionBeforeRepublish,
      publishVersionId: checkout.publishVersionId,
    });
  }
};

export const republishFlowsBulk = async ({ region, token, flows, ...republishRequest }) => {
  const response = await fetch("/api/genesys/architect/flow-republish/bulk", {
    method: "POST",
    headers: buildHeaders({ region, token }),
    body: JSON.stringify({ flows, ...republishRequest }),
  });
  const payload = await parseResponse(response);
  return payload.results || [];
};
