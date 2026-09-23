import assert from "node:assert/strict";
import { paginateLimitRows } from "../public/js/dashboard/widgets.js";

const rows = Array.from({ length: 25 }, (_, index) => ({ key: `limit-${index + 1}` }));

const page1 = paginateLimitRows(rows, 1);
assert.equal(page1.rows.length, 10);
assert.equal(page1.currentPage, 1);
assert.equal(page1.totalPages, 3);
assert.equal(page1.startIndex, 1);
assert.equal(page1.endIndex, 10);
assert.equal(page1.rows[0].key, "limit-1");

const page3 = paginateLimitRows(rows, 3);
assert.equal(page3.rows.length, 5);
assert.equal(page3.startIndex, 21);
assert.equal(page3.endIndex, 25);

const outOfRange = paginateLimitRows(rows, 99);
assert.equal(outOfRange.currentPage, 3);
assert.equal(outOfRange.rows.length, 5);

const empty = paginateLimitRows([], 1);
assert.equal(empty.rows.length, 0);
assert.equal(empty.totalPages, 1);
assert.equal(empty.startIndex, 0);
assert.equal(empty.endIndex, 0);

console.log("dashboard limits tests passed");
