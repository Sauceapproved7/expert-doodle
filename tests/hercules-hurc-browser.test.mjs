import test from "node:test";
import assert from "node:assert/strict";
import {
  HURC_BASE_FUNDS_URL,
  buildHurcBrowserRequest,
  callHerculesBrowser,
} from "../hercules-hurc/browser-adapter.mjs";

test("HURC browser request is pinned to official Base funds page", () => {
  const request = buildHurcBrowserRequest();
  assert.equal(request.action, "scrape");
  assert.equal(request.url, "https://docs.base.org/get-started/get-funds");
  assert.equal(request.steps.length, 0);
});

test("HURC browser adapter calls the owned Hercules browser gateway", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = {url, init};
    return {
      ok: true,
      status: 200,
      async text() { return JSON.stringify({ok:true, traceId:"test"}); },
    };
  };

  const result = await callHerculesBrowser(fetchImpl, {
    supabaseUrl: "https://example.supabase.co",
    internalKey: "server-only",
  });

  assert.equal(result.ok, true);
  assert.equal(seen.url, "https://example.supabase.co/functions/v1/hercules-browser");
  assert.equal(seen.init.headers["x-hercules-internal-key"], "server-only");
  const body = JSON.parse(seen.init.body);
  assert.equal(body.url, HURC_BASE_FUNDS_URL);
});

test("HURC browser adapter never places the internal key in the request body", async () => {
  let body;
  const fetchImpl = async (_url, init) => {
    body = init.body;
    return {
      ok: true,
      status: 200,
      async text() { return JSON.stringify({ok:true}); },
    };
  };
  await callHerculesBrowser(fetchImpl, {
    supabaseUrl: "https://example.supabase.co",
    internalKey: "do-not-leak",
  });
  assert.equal(String(body).includes("do-not-leak"), false);
});
