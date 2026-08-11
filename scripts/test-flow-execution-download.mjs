import assert from "node:assert/strict";
import {
  pickDownloadUri,
  pickJobStatus,
} from "../src/lib/flow-execution-download.js";

const sampleJobResponse = {
  id: "33d9903b-290e-499c-843f-a34e3fbbf5c1",
  entities: [
    {
      id: "5a6b3e67-b0ad-4e86-85e0-fc3fac9f11c9",
      downloadUri:
        "https://api-downloads.usw2.pure.cloud/renderedExecutionData/organizations/example/renderedData.json?Signature=abc",
      failed: false,
      statusCode: "200",
    },
  ],
  jobState: "Success",
  selfUri: "/api/v2/flows/instances/jobs/33d9903b-290e-499c-843f-a34e3fbbf5c1",
};

assert.equal(pickJobStatus(sampleJobResponse), "success");
assert.equal(
  pickDownloadUri(sampleJobResponse),
  sampleJobResponse.entities[0].downloadUri
);

assert.equal(
  pickDownloadUri({
    downloadURI: "https://api.example.com/api/v2/downloads/abc123",
  }),
  "https://api.example.com/api/v2/downloads/abc123"
);

assert.equal(pickDownloadUri({ entities: [{ failed: true, downloadUri: "https://example.com" }] }), null);

console.log("flow-execution download helper tests passed");
