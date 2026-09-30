import assert from "node:assert/strict";
import { createWorkerPool } from "../src/lib/concurrency/worker-pool.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Concurrency cap
{
  const pool = createWorkerPool();
  let active = 0;
  let maxActive = 0;

  const items = Array.from({ length: 20 }, (_, index) => ({ id: String(index) }));

  await pool.process(
    items,
    async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await sleep(20);
      active -= 1;
    },
    { concurrency: 4 }
  );

  assert.ok(maxActive <= 4, `expected max 4 active workers, saw ${maxActive}`);
}

// Failure isolation
{
  const pool = createWorkerPool({ defaultMaxRetries: 0 });
  const items = [{ id: "1" }, { id: "2" }, { id: "3" }];

  const { results, summary } = await pool.process(
    items,
    async (item) => {
      if (item.id === "2") {
        throw new Error("boom");
      }
      return { ok: true };
    },
    { concurrency: 2, maxRetries: 0, isRetryable: () => false }
  );

  assert.equal(summary.completed, 2);
  assert.equal(summary.failed, 1);
  assert.equal(results.filter((row) => row.status === "success").length, 2);
  assert.equal(results.find((row) => row.itemId === "2")?.status, "failed");
}

// Retry then success
{
  const pool = createWorkerPool({ defaultMaxRetries: 3, defaultRetryBaseDelayMs: 1 });
  const attempts = new Map();

  const { results } = await pool.process(
    [{ id: "a" }],
    async () => {
      const count = (attempts.get("a") || 0) + 1;
      attempts.set("a", count);
      if (count < 3) {
        const error = new Error("rate limited");
        error.status = 429;
        error.retryAfterMs = 1;
        throw error;
      }
      return { ok: true };
    },
    { concurrency: 1, maxRetries: 5, retryBaseDelayMs: 1 }
  );

  assert.equal(results[0]?.status, "success");
  assert.equal(attempts.get("a"), 3);
}

// Retry exhaustion
{
  const pool = createWorkerPool({ defaultMaxRetries: 2, defaultRetryBaseDelayMs: 1 });

  const { results } = await pool.process(
    [{ id: "x" }],
    async () => {
      const error = new Error("server error");
      error.status = 503;
      throw error;
    },
    { concurrency: 1, maxRetries: 2, retryBaseDelayMs: 1 }
  );

  assert.equal(results[0]?.status, "failed");
  assert.equal(results[0]?.attempts, 3);
}

// Large job bounded concurrency
{
  const pool = createWorkerPool();
  let maxActive = 0;
  let active = 0;
  const itemCount = 5000;

  const { summary } = await pool.process(
    Array.from({ length: itemCount }, (_, index) => ({ id: String(index) })),
    async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      active -= 1;
    },
    { concurrency: 4 }
  );

  assert.equal(summary.total, itemCount);
  assert.equal(summary.completed, itemCount);
  assert.equal(summary.failed, 0);
  assert.ok(maxActive <= 4);
  assert.ok(summary.maxActiveObserved <= 4);
}

console.log("worker pool tests passed");
