import assert from "node:assert/strict";
import {
  createMockApiService,
  normalizeEndpointSlug,
  redactHeaders,
  deriveUserpart,
} from "../src/lib/mock-api.js";
import { MOCK_API_CONFIG } from "../src/lib/mock-api-config.js";

const memoryDb = {
  endpoints: new Map(),
  logs: [],
};

const dbApi = {
  insertEndpoint: async (_db, endpoint) => {
    for (const existing of memoryDb.endpoints.values()) {
      if (
        existing.ownerUserpart === endpoint.ownerUserpart &&
        existing.method === endpoint.method &&
        existing.endpointSlug === endpoint.endpointSlug &&
        existing.status !== "deleted"
      ) {
        throw new Error("SQLITE_CONSTRAINT: UNIQUE constraint failed");
      }
    }
    memoryDb.endpoints.set(endpoint.id, { ...endpoint });
    return endpoint;
  },
  updateEndpoint: async (_db, endpoint) => {
    memoryDb.endpoints.set(endpoint.id, { ...endpoint });
    return endpoint;
  },
  getEndpointById: async (_db, { id, ownerUserpart }) => {
    const endpoint = memoryDb.endpoints.get(id);
    if (!endpoint || endpoint.ownerUserpart !== ownerUserpart) {
      return null;
    }
    if (endpoint.status === "deleted") {
      return null;
    }
    return endpoint;
  },
  getEndpointForInvocation: async (_db, { userpart, endpointSlug, method }) => {
    for (const endpoint of memoryDb.endpoints.values()) {
      if (
        endpoint.ownerUserpart === userpart &&
        endpoint.endpointSlug === endpointSlug &&
        endpoint.method === method &&
        endpoint.status === "active"
      ) {
        return endpoint;
      }
    }
    return null;
  },
  listEndpoints: async (_db, { ownerUserpart, statuses = [] }) =>
    [...memoryDb.endpoints.values()].filter(
      (endpoint) => endpoint.ownerUserpart === ownerUserpart && statuses.includes(endpoint.status)
    ),
  countActiveEndpoints: async (_db, { ownerUserpart }) =>
    [...memoryDb.endpoints.values()].filter(
      (endpoint) =>
        endpoint.ownerUserpart === ownerUserpart &&
        ["draft", "active", "expired"].includes(endpoint.status)
    ).length,
  markEndpointStatus: async (_db, { id, ownerUserpart, status, updatedAt }) => {
    const endpoint = memoryDb.endpoints.get(id);
    if (endpoint && endpoint.ownerUserpart === ownerUserpart) {
      endpoint.status = status;
      endpoint.updatedAt = updatedAt;
    }
  },
  recordEndpointUsage: async (_db, { id, lastUsedAt, expiresAt, hitCount }) => {
    const endpoint = memoryDb.endpoints.get(id);
    if (endpoint) {
      endpoint.lastUsedAt = lastUsedAt;
      endpoint.expiresAt = expiresAt;
      endpoint.hitCount = hitCount;
      endpoint.updatedAt = lastUsedAt;
    }
  },
  insertRequestLog: async (_db, log) => {
    memoryDb.logs.push({ ...log });
  },
  trimRequestLogs: async () => {},
  listRequestLogs: async (_db, { endpointId }) => memoryDb.logs.filter((log) => log.endpointId === endpointId),
  getRequestLogById: async (_db, { logId }) => memoryDb.logs.find((log) => log.id === logId) || null,
  purgeDeletedEndpoints: async () => 0,
  purgeArchivedEndpoints: async () => 0,
  expireStaleActiveEndpoints: async (_db, { now }) => {
    let changed = 0;
    for (const endpoint of memoryDb.endpoints.values()) {
      if (endpoint.status === "active" && endpoint.expiresAt && endpoint.expiresAt <= now) {
        endpoint.status = "expired";
        endpoint.updatedAt = now;
        changed += 1;
      }
    }
    return changed;
  },
};

const service = createMockApiService({
  db: memoryDb,
  ...dbApi,
});

assert.equal(normalizeEndpointSlug(" Customer Create "), "customer-create");
assert.equal(normalizeEndpointSlug("foo--bar"), "foo-bar");
assert.equal(normalizeEndpointSlug(""), "");

assert.deepEqual(redactHeaders({ Authorization: "secret", "X-Test": "ok" }), {
  Authorization: "[REDACTED]",
  "X-Test": "ok",
});

assert.equal(deriveUserpart({ email: "Jane.Doe@Example.com" }), "janedoe");

const owner = service.buildOwnerContext({
  user: { email: "jrhodes@example.com" },
  sessionId: "session-1",
  orgId: "org-1",
  orgName: "Example Org",
});

const created = await service.createEndpoint({
  owner,
  input: {
    endpointSlug: "customer-create",
    method: "POST",
    httpStatusCode: 201,
    responseContentType: "application/json",
    responseBody: '{"created":true}',
    responseHeaders: { "X-Test": "1" },
    delayMs: 0,
  },
  activate: true,
});

assert.equal(created.status, "active");
assert.equal(created.endpointSlug, "customer-create");

await assert.rejects(
  () =>
    service.createEndpoint({
      owner,
      input: {
        endpointSlug: "customer-create",
        method: "POST",
        httpStatusCode: 200,
        responseBody: "{}",
      },
      activate: true,
    }),
  /already exists/i
);

await assert.rejects(
  () =>
    service.createEndpoint({
      owner,
      input: {
        endpointSlug: "bad json",
        method: "GET",
        responseContentType: "application/json",
        responseBody: "{not-json",
      },
    }),
  /valid JSON/i
);

const expired = {
  ...created,
  status: "active",
  expiresAt: Date.now() - 1000,
};
memoryDb.endpoints.set(expired.id, expired);
await service.refreshLifecycle();
const afterExpire = memoryDb.endpoints.get(expired.id);
assert.equal(afterExpire.status, "expired");

assert.equal(MOCK_API_CONFIG.maxEndpointsPerUser, 25);

const orgAOwner = service.buildOwnerContext({
  user: { email: "jrhodes@example.com" },
  sessionId: "session-a",
  orgId: "org-a",
  orgName: "Org A",
});
const orgBOwner = service.buildOwnerContext({
  user: { email: "jrhodes@example.com" },
  sessionId: "session-b",
  orgId: "org-b",
  orgName: "Org B",
});

await service.createEndpoint({
  owner: orgAOwner,
  input: {
    endpointSlug: "org-scoped-test",
    method: "GET",
    responseBody: '{"org":"a"}',
  },
  activate: true,
});

const listedFromOtherOrg = await service.listOwnedEndpoints({ owner: orgBOwner, group: "active" });
assert.equal(
  listedFromOtherOrg.some((endpoint) => endpoint.endpointSlug === "org-scoped-test"),
  true,
  "endpoints should be visible regardless of connected org"
);

console.log("mock-api tests passed");
