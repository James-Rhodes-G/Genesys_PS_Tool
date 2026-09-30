process.env.GENESYS_API_CONCURRENCY = "2";
process.env.WORKER_COUNT = "2";
process.env.MAX_RETRIES = "1";
process.env.RETRY_BASE_DELAY_MS = "1";

import assert from "node:assert/strict";
import { createJobManager } from "../src/lib/jobs/job-manager.js";
import { JOB_STATUS } from "../src/lib/jobs/types.js";

const originalFetch = globalThis.fetch;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const jsonResponse = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get() { return null; } },
  text: async () => JSON.stringify(body),
});

const waitForTerminalJob = async (jobManager, jobId, timeoutMs = 5000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const job = jobManager.getJob(jobId);
    if (
      job &&
      [JOB_STATUS.COMPLETED, JOB_STATUS.COMPLETED_WITH_ERRORS, JOB_STATUS.FAILED, JOB_STATUS.CANCELLED].includes(
        job.status
      )
    ) {
      return job;
    }
    await sleep(20);
  }
  throw new Error(`Job ${jobId} did not finish in time`);
};

// End-to-end bulk-skill-assign with mocked Genesys API
{
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount === 2) {
      return jsonResponse(500, { message: "temporary" });
    }
    return jsonResponse(200, { assigned: true });
  };

  const jobManager = createJobManager();

  const { jobId, status } = await jobManager.submitJob({
    type: "bulk-skill-assign",
    payload: {
      userIds: ["user-1", "user-2", "user-3"],
      skills: [{ id: "skill-1", proficiency: 5 }],
    },
    credentials: { region: "us-east-1", token: "test-token" },
  });

  assert.equal(status, JOB_STATUS.QUEUED);

  const finished = await waitForTerminalJob(jobManager, jobId);
  assert.equal(finished.total, 3);
  assert.equal(finished.completed, 3);
  assert.equal(finished.failed, 0);
  assert.ok(finished.metrics);
  assert.equal(finished.metrics.successfulItems, 3);
  assert.ok(finished.metrics.durationMs >= 0);
  assert.ok(finished.metrics.itemsPerSecond >= 0);

  const resultsPage = jobManager.getJobResults(jobId, { offset: 0, limit: 10 });
  assert.equal(resultsPage.total, 3);
  assert.equal(resultsPage.results.length, 3);

  globalThis.fetch = originalFetch;
}

// Failure isolation
{
  globalThis.fetch = async (url) => {
    if (String(url).includes("user-b")) {
      return jsonResponse(403, { message: "forbidden" });
    }
    return jsonResponse(200, { assigned: true });
  };

  const jobManager = createJobManager();
  const { jobId } = await jobManager.submitJob({
    type: "bulk-skill-assign",
    payload: {
      userIds: ["user-a", "user-b", "user-c"],
      skills: [{ id: "skill-1", proficiency: 5 }],
    },
    credentials: { region: "us-east-1", token: "test-token" },
  });

  const finished = await waitForTerminalJob(jobManager, jobId);
  assert.equal(finished.completed, 2);
  assert.equal(finished.failed, 1);
  assert.equal(finished.status, JOB_STATUS.COMPLETED_WITH_ERRORS);

  globalThis.fetch = originalFetch;
}

// bulk-phone-move with mocked Genesys GET + PUT per phone
{
  globalThis.fetch = async (_url, init = {}) => {
    if ((init.method || "GET") === "GET") {
      return jsonResponse(200, {
        id: "phone-1",
        name: "test-phone",
        site: { id: "site-old", name: "Old Site" },
        phoneBaseSettings: { id: "pbs-1" },
        webRtcUser: { id: "user-1" },
        lines: [{ id: "line-1", name: "Line 1", lineBaseSettings: { id: "lbs-1" } }],
      });
    }

    return jsonResponse(200, {
      id: "phone-1",
      name: "test-phone",
      site: { id: "site-new", name: "New Site" },
    });
  };

  const jobManager = createJobManager();
  const { jobId } = await jobManager.submitJob({
    type: "bulk-phone-move",
    payload: {
      phoneIds: ["phone-1", "phone-2"],
      siteId: "site-new",
      siteName: "New Site",
    },
    credentials: { region: "us-east-1", token: "test-token" },
  });

  const finished = await waitForTerminalJob(jobManager, jobId);
  assert.equal(finished.total, 2);
  assert.equal(finished.completed, 2);
  assert.equal(finished.failed, 0);

  const resultsPage = jobManager.getJobResults(jobId, { offset: 0, limit: 10 });
  assert.equal(resultsPage.results.length, 2);
  assert.equal(resultsPage.results[0].phoneId, "phone-1");
  assert.equal(resultsPage.results[0].status, "success");

  globalThis.fetch = originalFetch;
}

// user-role-export with mocked authorization subject
{
  globalThis.fetch = async (url) => {
    if (String(url).includes("/authorization/subjects/")) {
      return jsonResponse(200, {
        id: "user-1",
        grants: [{ role: { name: "Agent" }, division: { name: "Home" } }],
      });
    }
    return jsonResponse(200, {});
  };

  const jobManager = createJobManager();
  const { jobId } = await jobManager.submitJob({
    type: "user-role-export",
    payload: {
      users: [{ id: "user-1", name: "Test User", userName: "tuser" }],
    },
    credentials: { region: "us-east-1", token: "test-token" },
  });

  const finished = await waitForTerminalJob(jobManager, jobId);
  assert.equal(finished.completed, 1);

  const partial = jobManager.getJobResults(jobId, { offset: 0, limit: 10, userId: "user-1" });
  assert.equal(partial.results.length, 1);
  assert.equal(partial.results[0].userId, "user-1");
  assert.match(partial.results[0].roleAssignments, /Agent:Home/);

  globalThis.fetch = originalFetch;
}

console.log("job manager tests passed");
