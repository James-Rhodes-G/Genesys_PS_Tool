process.env.GENESYS_API_CONCURRENCY = "1";

import assert from "node:assert/strict";
import {
  parseRetryAfterMs,
  resetGenesysRequestScheduler,
  resolveRateLimitDelayMs,
  runGenesysHttp,
} from "../src/lib/genesys-rate-limit.js";

resetGenesysRequestScheduler();

const calls = [];
const startedAt = Date.now();
const okResponse = () => ({
  status: 200,
  headers: { get() { return null; } },
});

await Promise.all([
  runGenesysHttp(async () => {
    calls.push({ id: 1, elapsedMs: Date.now() - startedAt });
    return okResponse();
  }),
  runGenesysHttp(async () => {
    calls.push({ id: 2, elapsedMs: Date.now() - startedAt });
    return okResponse();
  }),
  runGenesysHttp(async () => {
    calls.push({ id: 3, elapsedMs: Date.now() - startedAt });
    return okResponse();
  }),
]);

assert.equal(calls.length, 3);
assert.ok(calls[1].elapsedMs - calls[0].elapsedMs >= 200);
assert.ok(calls[2].elapsedMs - calls[1].elapsedMs >= 200);

const retryAfterSecondsResponse = {
  headers: {
    get(name) {
      return name.toLowerCase() === "retry-after" ? "5" : null;
    },
  },
};

assert.equal(parseRetryAfterMs(retryAfterSecondsResponse), 5000);
assert.equal(resolveRateLimitDelayMs(retryAfterSecondsResponse, 0), 5000);

const retryAfterDate = new Date(Date.now() + 8000).toUTCString();
const retryAfterDateResponse = {
  headers: {
    get(name) {
      return name.toLowerCase() === "retry-after" ? retryAfterDate : null;
    },
  },
};

const parsedDateDelay = parseRetryAfterMs(retryAfterDateResponse);
assert.ok(parsedDateDelay >= 7000 && parsedDateDelay <= 9000);

assert.equal(resolveRateLimitDelayMs(null, 2), 4000);

resetGenesysRequestScheduler();

let fetchAttempts = 0;
const backoffStartedAt = Date.now();

const successResponse = await runGenesysHttp(async () => {
  fetchAttempts += 1;
  if (fetchAttempts === 1) {
    return {
      status: 429,
      headers: {
        get(name) {
          return name.toLowerCase() === "retry-after" ? "1" : null;
        },
      },
    };
  }

  return {
    status: 200,
    headers: { get() { return null; } },
  };
});

assert.equal(successResponse.status, 200);
assert.equal(fetchAttempts, 2);
assert.ok(Date.now() - backoffStartedAt >= 900);

console.log("genesys rate limit tests passed");
