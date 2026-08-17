const buildHeaders = ({ region, token }) => ({
  "Content-Type": "application/json",
  "x-genesys-region": region,
  "x-genesys-token": token,
});

const executionModelCache = new Map();

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const prefix = payload.source === "genesys" ? "Genesys API error: " : "";
    throw new Error(prefix + (payload.error || `Request failed (${response.status}).`));
  }
  return payload;
};

export const clearFlowExecutionModelCache = () => {
  executionModelCache.clear();
};

export const fetchFlowExecutions = async ({ region, token, conversationId }) => {
  const response = await fetch("/api/genesys/flow-executions", {
    method: "POST",
    headers: buildHeaders({ region, token }),
    body: JSON.stringify({ conversationId }),
  });
  return parseResponse(response);
};

export const downloadFlowExecutionModel = async ({
  region,
  token,
  instanceId,
  conversationId,
  flowName,
  flowType,
  flowVersion,
}) => {
  const cacheKey = String(instanceId || "").trim();
  if (cacheKey) {
    const cached = executionModelCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const response = await fetch(`/api/genesys/flow-executions/${encodeURIComponent(instanceId)}/download`, {
    method: "POST",
    headers: buildHeaders({ region, token }),
    body: JSON.stringify({ conversationId, flowName, flowType, flowVersion }),
  });
  const payload = await parseResponse(response);

  if (cacheKey) {
    executionModelCache.set(cacheKey, payload);
  }

  return payload;
};
