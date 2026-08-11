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
  const response = await fetch(`/api/genesys/flow-executions/${encodeURIComponent(instanceId)}/download`, {
    method: "POST",
    headers: buildHeaders({ region, token }),
    body: JSON.stringify({ conversationId, flowName, flowType, flowVersion }),
  });
  return parseResponse(response);
};
