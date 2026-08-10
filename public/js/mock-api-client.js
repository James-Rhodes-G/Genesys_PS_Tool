const buildHeaders = ({ region, token }) => ({
  "Content-Type": "application/json",
  "x-genesys-region": region,
  "x-genesys-token": token,
});

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload;
};

export const fetchMockApiConfig = async () => {
  const response = await fetch("/api/mock-api/config");
  return parseResponse(response);
};

export const fetchMockApiContext = async ({ region, token }) => {
  const response = await fetch("/api/mock-api/context", {
    headers: buildHeaders({ region, token }),
  });
  return parseResponse(response);
};

export const fetchMockApiEndpoints = async ({ region, token, group = "active" }) => {
  const response = await fetch(`/api/mock-api/endpoints?group=${encodeURIComponent(group)}`, {
    headers: buildHeaders({ region, token }),
  });
  return parseResponse(response);
};

export const fetchMockApiEndpoint = async ({ region, token, id }) => {
  const response = await fetch(`/api/mock-api/endpoints/${encodeURIComponent(id)}`, {
    headers: buildHeaders({ region, token }),
  });
  return parseResponse(response);
};

export const createMockApiEndpoint = async ({ region, token, payload }) => {
  const response = await fetch("/api/mock-api/endpoints", {
    method: "POST",
    headers: buildHeaders({ region, token }),
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
};

export const updateMockApiEndpoint = async ({ region, token, id, payload }) => {
  const response = await fetch(`/api/mock-api/endpoints/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: buildHeaders({ region, token }),
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
};

export const activateMockApiEndpoint = async ({ region, token, id }) => {
  const response = await fetch(`/api/mock-api/endpoints/${encodeURIComponent(id)}/activate`, {
    method: "POST",
    headers: buildHeaders({ region, token }),
  });
  return parseResponse(response);
};

export const archiveMockApiEndpoint = async ({ region, token, id }) => {
  const response = await fetch(`/api/mock-api/endpoints/${encodeURIComponent(id)}/archive`, {
    method: "POST",
    headers: buildHeaders({ region, token }),
  });
  return parseResponse(response);
};

export const restoreMockApiEndpoint = async ({ region, token, id }) => {
  const response = await fetch(`/api/mock-api/endpoints/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    headers: buildHeaders({ region, token }),
  });
  return parseResponse(response);
};

export const cloneMockApiEndpoint = async ({ region, token, id }) => {
  const response = await fetch(`/api/mock-api/endpoints/${encodeURIComponent(id)}/clone`, {
    method: "POST",
    headers: buildHeaders({ region, token }),
  });
  return parseResponse(response);
};

export const deleteMockApiEndpoint = async ({ region, token, id }) => {
  const response = await fetch(`/api/mock-api/endpoints/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: buildHeaders({ region, token }),
  });
  return parseResponse(response);
};

export const fetchMockApiEndpointLogs = async ({ region, token, id, limit = 100, offset = 0 }) => {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const response = await fetch(
    `/api/mock-api/endpoints/${encodeURIComponent(id)}/logs?${params.toString()}`,
    {
      headers: buildHeaders({ region, token }),
    }
  );
  return parseResponse(response);
};

export const fetchMockApiLog = async ({ region, token, logId }) => {
  const response = await fetch(`/api/mock-api/logs/${encodeURIComponent(logId)}`, {
    headers: buildHeaders({ region, token }),
  });
  return parseResponse(response);
};
