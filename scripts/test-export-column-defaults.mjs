import assert from "node:assert/strict";
import { initAdminDb, upsertExportColumnDefault, buildExportColumnDefaultsMap, deleteExportColumnDefault } from "../src/data/admin-db.js";
import { isKnownInteractiveExportKey, normalizeColumnKeys } from "../src/lib/export-column-defaults.js";

const db = await initAdminDb();

assert.deepEqual(normalizeColumnKeys("name, id\nid"), ["name", "id"]);
assert.equal(isKnownInteractiveExportKey("users"), true);
assert.equal(isKnownInteractiveExportKey("not-real"), false);

await upsertExportColumnDefault(db, {
  exportKey: "users",
  selectedColumns: ["name", "id", "department"],
  updatedBy: "test",
});
const map = await buildExportColumnDefaultsMap(db);
assert.deepEqual(map.users, ["name", "id", "department"]);
await deleteExportColumnDefault(db, "users");

console.log("test-export-column-defaults.mjs passed");