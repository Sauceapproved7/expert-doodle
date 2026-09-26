import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const contract = await readFile(
  new URL("../docs/openapi/hercules-forge-v1.yaml", import.meta.url),
  "utf8",
);

test("Forge OpenAPI contract covers security-critical public and operator surfaces", () => {
  assert.match(contract, /^openapi:\s*3\.2\.1/m);
  assert.match(contract, /^\s*version:\s*1\.6\.0\s*$/m);
  for (const path of [
    "/health:",
    "/v1/invites/accept:",
    "/v1/recovery/request:",
    "/v1/recovery/complete:",
    "/v1/session:",
    "/v1/session/csrf:",
    "/v1/me:",
    "/v1/workspaces/{workspaceId}:",
    "/v1/workspaces/{workspaceId}/invites:",
    "/v1/workspaces/{workspaceId}/audit:",
    "/v1/admin/workspaces/{workspaceId}/invites:",
    "/v1/projects/{projectId}/publish:",
    "/v1/projects/{projectId}/rollback:",
  ]) {
    assert.ok(contract.includes(path), "missing OpenAPI path " + path);
  }
  assert.match(contract, /controlBearer:/);
  assert.match(contract, /x-forge-csrf/);
  assert.match(contract, /InviteRole:/);
  assert.match(contract, /enum: \[admin, builder, viewer\]/);
  assert.match(contract, /Recovery request accepted without revealing account existence/);
});
