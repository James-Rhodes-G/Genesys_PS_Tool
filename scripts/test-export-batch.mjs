import assert from "node:assert/strict";
import { buildCatalogExportZip } from "../src/lib/exports/build-export-zip.js";
import * as exportBatch from "../src/lib/jobs/handlers/export-batch.js";

const items = exportBatch.buildItems({ exportIds: ["divisions", "skills", "unknown"] });
assert.equal(items.length, 3);
assert.equal(items[0].itemId, "divisions");

let buildError = null;
try {
  exportBatch.buildItems({ exportIds: [] });
} catch (error) {
  buildError = error;
}
assert.ok(buildError);

const { buffer, filename, included } = await buildCatalogExportZip({
  orgName: "Demo Org",
  artifacts: [
    {
      exportId: "divisions",
      rows: [{ name: "Home", id: "1" }],
      preferredColumns: ["name", "id"],
    },
    {
      exportId: "skills",
      rows: [],
    },
  ],
  zipLabel: "documentation",
});

assert.ok(buffer && buffer.length > 0);
assert.match(filename, /Demo_Org_documentation_/);
assert.equal(included, 1);

console.log("test-export-batch.mjs: ok");
