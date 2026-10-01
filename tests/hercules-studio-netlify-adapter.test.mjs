import test from "node:test";
import assert from "node:assert/strict";
import { handler } from "../netlify/functions/studio.mjs";

test("Netlify adapter serves Studio health through the canonical handler", async () => {
  const response = await handler({
    httpMethod: "GET",
    path: "/health",
    rawUrl: "https://studio.example/health",
    headers: { host: "studio.example" },
    queryStringParameters: null,
    body: null,
    isBase64Encoded: false
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"], /application\/json/);
  const payload = JSON.parse(response.body);
  assert.equal(payload.ok, true);
});

test("Netlify adapter preserves fail-closed mutation behavior", async () => {
  const response = await handler({
    httpMethod: "POST",
    path: "/api/studio/execute",
    rawUrl: "https://studio.example/api/studio/execute",
    headers: { host: "studio.example", "content-type": "application/json" },
    queryStringParameters: null,
    body: JSON.stringify({ action: "render" }),
    isBase64Encoded: false
  });

  assert.notEqual(response.statusCode, 200);
});
