import assert from "node:assert/strict";
import {
  compareVersions,
  normalizeVersionTag,
  readServerPackageVersion,
} from "../src/lib/github-update-check.js";

assert.equal(normalizeVersionTag("v1.2.3"), "1.2.3");
assert.equal(normalizeVersionTag("V0.10.0"), "0.10.0");

assert.equal(compareVersions("0.1.0", "0.2.0"), -1);
assert.equal(compareVersions("0.2.0", "0.1.0"), 1);
assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
assert.equal(compareVersions("1.0.0-beta", "1.0.0"), -1);
assert.equal(compareVersions("1.0.0", "1.0.0-rc.1"), 1);

const pkgVersion = readServerPackageVersion();
assert.match(pkgVersion, /^\d+\.\d+\.\d+/);

console.log("test-github-update-check.mjs passed");
