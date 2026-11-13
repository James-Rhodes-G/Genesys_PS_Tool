import assert from "node:assert/strict";
import { buildDataTableCsv } from "../src/lib/datatables-export-csv.js";

const csv = buildDataTableCsv([
  { tableId: "t1", tableName: "Demo", key: "row1", language: "en", text: "Hello" },
  { tableId: "t1", tableName: "Demo", key: "row2", language: "es", text: "Hola" },
]);

assert.match(csv, /key,language,text/);
assert.match(csv, /row1,en,Hello/);
assert.match(csv, /row2,es,Hola/);

console.log("test-datatables-export.mjs passed");
