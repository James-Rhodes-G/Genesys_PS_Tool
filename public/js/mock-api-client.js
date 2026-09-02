import { isVaultMode } from "./genesys-auth.js";

const buildHeaders = ({ region, token }) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (!isVaultMode()) {
    headers["x-genesys-region"] = region;
    headers["x-genesys-token"] = token;
  }

  return headers;
};

const withFetchOptions = ({ region, token, ...options }) => ({
  credentials: "include",
  ...options,
  headers: {
    ...buildHeaders({ region, token }),
    ...(options.headers || {}),
  },
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
  const response = await fetch("/api/mock-api/context", withFetchOptions({ region, token }));
  return parseResponse(response);
};

export const fetchMockApiEndpoints = async ({ region, token, group = "active" }) => {
  const response = await fetch(
    `/api/mock-api/endpoints?group=${encodeURIComponent(group)}`,
    withFetchOptions({ region, token })
  );
  return parseResponse(response);
};

export const fetchMockApiEndpoint = async ({ region, token, id }) => {
  const response = await fetch(
    `/api/mock-api/endpoints/${encodeURIComponent(id)}`,
    withFetchOptions({ region, token })
  );
  return parseResponse(response);
};

export const createMockApiEndpoint = async ({ region, token, payload }) => {
  const response = await fetch(
    "/api/mock-api/endpoints",
    withFetchOptions({
      region,
      token,
      method: "POST",
      body: JSON.stringify(payload),
    })
  );
  return parseResponse(response);
};

export const updateMockApiEndpoint = async ({ region, token, id, payload }) => {
  const response = await fetch(
    `/api/mock-api/endpoints/${encodeURIComponent(id)}`,
    withFetchOptions({
      region,
      token,
      method: "PUT",
      body: JSON.stringify(payload),
    })
  );
  return parseResponse(response);
};

export const activateMockApiEndpoint = async ({ region, token, id }) => {
  const response = await fetch(
    `/api/mock-api/endpoints/${encodeURIComponent(id)}/activate`,
    withFetchOptions({ region, token, method: "POST" })
  );
  return parseResponse(response);
};

export const archiveMockApiEndpoint = async ({ region, token, id }) => {
  const response = await fetch(
    `/api/mock-api/endpoints/${encodeURIComponent(id)}/archive`,
    withFetchOptions({ region, token, method: "POST" })
  );
  return parseResponse(response);
};

export const restoreMockApiEndpoint = async ({ region, token, id }) => {
  const response = await fetch(
    `/api/mock-api/endpoints/${encodeURIComponent(id)}/restore`,
    withFetchOptions({ region, token, method: "POST" })
  );
  return parseResponse(response);
};

export const cloneMockApiEndpoint = async ({ region, token, id }) => {
  const response = await fetch(
    `/api/mock-api/endpoints/${encodeURIComponent(id)}/clone`,
    withFetchOptions({ region, token, method: "POST" })
  );
  return parseResponse(response);
};

export const deleteMockApiEndpoint = async ({ region, token, id }) => {
  const response = await fetch(
    `/api/mock-api/endpoints/${encodeURIComponent(id)}`,
    withFetchOptions({ region, token, method: "DELETE" })
  );
  return parseResponse(response);
};

export const fetchMockApiEndpointLogs = async ({ region, token, id, limit = 100, offset = 0 }) => {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const response = await fetch(
    `/api/mock-api/endpoints/${encodeURIComponent(id)}/logs?${params.toString()}`,
    withFetchOptions({ region, token })
  );
  return parseResponse(response);
};

export const fetchMockApiLog = async ({ region, token, logId }) => {
  const response = await fetch(
    `/api/mock-api/logs/${encodeURIComponent(logId)}`,
    withFetchOptions({ region, token })
  );
  return parseResponse(response);
};
