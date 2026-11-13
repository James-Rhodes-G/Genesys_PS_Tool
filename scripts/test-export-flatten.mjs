import assert from "node:assert/strict";
import { flattenRow, getByPath } from "../src/lib/exports/flatten-row.js";
import { buildCsvFromRows } from "../src/lib/exports/rows-to-csv.js";
import { getExportById, listDefaultBatchExportIds } from "../src/lib/exports/export-registry.js";

assert.equal(getByPath({ division: { name: "Home" } }, "division.name"), "Home");

const flat = flattenRow(
  { name: "Q1", id: "abc", division: { name: "East", id: "div-1" }, memberCount: 3 },
  { preferredColumns: ["name", "id", "division.name", "memberCount"] }
);

assert.deepEqual(flat, {
  name: "Q1",
  id: "abc",
  "division.name": "East",
  memberCount: 3,
});

const csv = buildCsvFromRows([flat], { preferredColumns: ["name", "id", "division.name", "memberCount"] });
assert.match(csv, /name,id,division.name,memberCount/);
assert.match(csv, /Q1,abc,East,3/);

assert.ok(getExportById("divisions"));
assert.ok(listDefaultBatchExportIds().includes("wrapup-codes"));

console.log("test-export-flatten.mjs: ok");
