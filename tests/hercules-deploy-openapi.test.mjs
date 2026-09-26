import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const contract = await readFile(
  new URL("../docs/openapi/hercules-deploy-v0.1.yaml", import.meta.url),
  "utf8",
);

test("Deploy Plane OpenAPI covers background deployment control surfaces", () => {
  assert.match(contract, /^openapi:\s*3\.2\.1/m);
  assert.match(contract, /^\s*version:\s*0\.1\.0\s*$/m);
  for (const path of [
    "/health:",
    "/ready:",
    "/v1/deployments:",
    "/v1/deployments/{deploymentId}:",
    "/v1/deployments/{deploymentId}/retry:",
    "/v1/deployments/{deploymentId}/rollback:",
    "/v1/worker/run-once:",
  ]) {
    assert.ok(contract.includes(path), "missing Deploy Plane OpenAPI path " + path);
  }
  assert.match(contract, /controlBearer:/);
  assert.match(contract, /artifactFingerprint:/);
  assert.match(contract, /sourceCommit:/);
  assert.match(contract, /pattern: "\^https:\/\/"|pattern: "\^https:\/\//);
});
