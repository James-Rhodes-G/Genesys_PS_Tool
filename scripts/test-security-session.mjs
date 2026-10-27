import assert from "node:assert/strict";
import crypto from "crypto";
import { createSignedSessionId, parseSignedSessionId } from "../src/lib/session-token.js";
import { safeJsonForScript } from "../src/lib/safe-json-for-script.js";
import { escapeCsvValue } from "../public/js/export-format.js";

process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");

const signed = createSignedSessionId();
assert.match(signed, /^[0-9a-f-]{36}\.[A-Za-z0-9_-]+$/i);
assert.equal(parseSignedSessionId(signed)?.length, 36);
assert.equal(parseSignedSessionId(`${signed}x`), null);
assert.equal(parseSignedSessionId("not-a-valid-session"), null);

const malicious = safeJsonForScript({ name: "</script><script>alert(1)//" });
assert.ok(!malicious.includes("</script>"));
assert.ok(malicious.includes("\\u003c"));

assert.equal(escapeCsvValue("=1+1"), "'=1+1");
assert.equal(escapeCsvValue("hello"), "hello");
assert.equal(escapeCsvValue("=1+1", { neutralizeFormulas: false }), "=1+1");

console.log("test-security-session.mjs passed");
