process.env.GENESYS_API_CONCURRENCY = "1";
process.env.MAX_HTTP_RETRIES = "3";
process.env.RETRY_BASE_DELAY_MS = "1";

import assert from "node:assert/strict";
import { createGenesysApiClient } from "../src/lib/genesys/api-client.js";
import { createTokenManager } from "../src/lib/genesys/token-manager.js";
import { resetGenesysRequestScheduler } from "../src/lib/genesys-rate-limit.js";

const originalFetch = globalThis.fetch;

const mockFetch = (responses) => {
  let callIndex = 0;
  globalThis.fetch = async () => {
    const next = responses[Math.min(callIndex, responses.length - 1)];
    callIndex += 1;
    return typeof next === "function" ? next(callIndex) : next;
  };
};

const restoreFetch = () => {
  globalThis.fetch = originalFetch;
};

const jsonResponse = (status, body, headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: {
    get(name) {
      const key = String(name || "").toLowerCase();
      return headers[key] ?? null;
    },
  },
  text: async () => JSON.stringify(body),
});

resetGenesysRequestScheduler();

// 429 -> backoff -> retry -> 200
{
  mockFetch([
    jsonResponse(429, { message: "rate limited" }, { "retry-after": "1" }),
    jsonResponse(200, { ok: true }),
  ]);

  const tokenManager = createTokenManager({ region: "us-east-1", token: "test-token" });
  const client = createGenesysApiClient({ tokenManager, region: "us-east-1" });

  const data = await client.get("/api/v2/users/me");
  assert.deepEqual(data, { ok: true });

  restoreFetch();
  resetGenesysRequestScheduler();
}

// No retry on 404
{
  let calls = 0;
  mockFetch([
    () => {
      calls += 1;
      return jsonResponse(404, { message: "not found" });
    },
  ]);

  const tokenManager = createTokenManager({ region: "us-east-1", token: "test-token" });
  const client = createGenesysApiClient({ tokenManager, region: "us-east-1" });

  await assert.rejects(() => client.get("/api/v2/users/missing"), (error) => error.status === 404);
  assert.equal(calls, 1);

  restoreFetch();
  resetGenesysRequestScheduler();
}

// 401 refresh mutex - only one refresh for concurrent 401s
{
  let fetchCalls = 0;
  let refreshCalls = 0;

  mockFetch([
    () => {
      fetchCalls += 1;
      return jsonResponse(401, { message: "unauthorized" });
    },
    () => jsonResponse(200, { ok: true }),
    () => {
      fetchCalls += 1;
      return jsonResponse(401, { message: "unauthorized" });
    },
    () => jsonResponse(200, { ok: true }),
  ]);

  const tokenManager = createTokenManager({
    region: "us-east-1",
    token: "old-token",
    onRefresh: async () => {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { region: "us-east-1", token: "new-token" };
    },
  });

  const client = createGenesysApiClient({ tokenManager, region: "us-east-1" });

  const [first, second] = await Promise.all([
    client.get("/api/v2/users/a"),
    client.get("/api/v2/users/b"),
  ]);

  assert.deepEqual(first, { ok: true });
  assert.deepEqual(second, { ok: true });
  assert.equal(refreshCalls, 2);
  assert.ok(fetchCalls >= 2);

  restoreFetch();
  resetGenesysRequestScheduler();
}

// Retry exhaustion on 503
{
  mockFetch([
    jsonResponse(503, { message: "unavailable" }),
    jsonResponse(503, { message: "unavailable" }),
    jsonResponse(503, { message: "unavailable" }),
    jsonResponse(503, { message: "unavailable" }),
  ]);

  const tokenManager = createTokenManager({ region: "us-east-1", token: "test-token" });
  const client = createGenesysApiClient({ tokenManager, region: "us-east-1" });

  await assert.rejects(() => client.get("/api/v2/users/me"), (error) => error.status === 503);

  restoreFetch();
}

restoreFetch();
console.log("genesys api client tests passed");
