import assert from "node:assert/strict";
import { INCREMENTAL_BULK_ROUTES } from "../src/lib/admin-prevention.js";
import { createRateLimiter } from "../src/lib/launch-validation.js";

assert.ok(INCREMENTAL_BULK_ROUTES.has("/api/genesys/phones/bulk-move"));
assert.ok(INCREMENTAL_BULK_ROUTES.has("/api/genesys/phones/bulk-delete"));
assert.ok(INCREMENTAL_BULK_ROUTES.has("/api/genesys/phones/bulk-build"));

const limiter = createRateLimiter({
  limit: 1,
  windowMs: 60_000,
  keyFn: () => "test",
});

const runLimiter = () =>
  new Promise((resolve) => {
    limiter(
      { ip: "127.0.0.1" },
      {
        status(code) {
          this.statusCode = code;
          return this;
        },
        setHeader() {},
        json(payload) {
          resolve({ status: this.statusCode, payload });
        },
      },
      () => resolve({ status: 200, payload: { ok: true } })
    );
  });

const first = await runLimiter();
const second = await runLimiter();

assert.equal(first.status, 200);
assert.equal(second.status, 429);
assert.equal(second.payload.error, "Too many requests.");

console.log("admin prevention tests passed");
