import { buildGenesysApiUrl } from "./genesys.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeHeaders = (headers = {}) => {
  const nextHeaders = new Headers(headers);

  if (!nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  return nextHeaders;
};

const genesysRequestWithMeta = async ({
  region,
  token,
  path,
  method = "GET",
  headers = {},
  body,
  retries = 3,
}) => {
  if (!token) {
    throw new Error("Genesys token is required");
  }

  const url = await buildGenesysApiUrl(region, path);
  let attempt = 0;

  while (attempt <= retries) {
    const requestHeaders = normalizeHeaders(headers);
    requestHeaders.set("Authorization", `Bearer ${token}`);

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body == null ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (response.status === 429 && attempt < retries) {
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const delayMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : Math.min(1000 * 2 ** attempt, 10000);
      await wait(delayMs);
      attempt += 1;
      continue;
    }

    if (!response.ok) {
      const message = data?.message || data?.error || `Genesys request failed with ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.details = data;
      throw error;
    }

    return {
      data,
      status: response.status,
      partial: response.status === 206,
    };
  }

  throw new Error(`Genesys request retries exhausted for ${path}`);
};

export { genesysRequestWithMeta };
