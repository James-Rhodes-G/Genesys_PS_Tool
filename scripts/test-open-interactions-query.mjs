import assert from "node:assert/strict";
import {
  buildOpenInteractionsLookbackWindows,
  buildOpenInteractionsQueryBody,
  normalizeOpenInteractionsLookbackDays,
} from "../src/lib/genesys.js";

assert.equal(normalizeOpenInteractionsLookbackDays(7), 7);
assert.equal(normalizeOpenInteractionsLookbackDays(undefined), 30);
assert.equal(normalizeOpenInteractionsLookbackDays(120), 90);

const queueId = "queue-1";
const intervalStart = new Date("2026-03-01T15:30:00.000Z");
const intervalEnd = new Date("2026-03-08T10:15:00.000Z");

const body = buildOpenInteractionsQueryBody({
  queueId,
  intervalStart,
  intervalEnd,
  scope: "waiting",
  mediaTypes: ["voice", "chat"],
  pageNumber: 2,
  pageSize: 50,
});

assert.equal(body.interval, "2026-03-01T00:00:00.000Z/2026-03-08T23:59:59.999Z");
assert.equal(body.paging.pageNumber, 2);
assert.equal(body.paging.pageSize, 50);
assert.equal(body.segmentFilters[0].predicates.some((predicate) => predicate.dimension === "queueId"), true);
assert.equal(
  body.segmentFilters[0].predicates.some(
    (predicate) => predicate.dimension === "purpose" && predicate.value === "acd"
  ),
  true
);
assert.equal(
  body.conversationFilters[0].predicates.some((predicate) => predicate.dimension === "conversationEnd"),
  true
);

const shortWindows = buildOpenInteractionsLookbackWindows(7);
assert.equal(shortWindows.length, 1);

const longWindows = buildOpenInteractionsLookbackWindows(60);
assert.ok(longWindows.length >= 2);

const coveredDays = new Set();
longWindows.forEach((window) => {
  assert.ok(window.intervalStart <= window.intervalEnd);
  const day = window.intervalStart.toISOString().slice(0, 10);
  coveredDays.add(day);
});

console.log("open interactions query tests passed");
