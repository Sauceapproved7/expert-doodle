import test from "node:test";
import assert from "node:assert/strict";
import {
  HURC_BASE_FUNDS_URL,
  HURC_QUICKNODE_FAUCET_URL,
  buildHurcBrowserRequest,
  buildHurcFaucetStepOneRequest,
  callHerculesBrowser,
} from "../hercules-hurc/browser-adapter.mjs";

const SIGNER = "0xa38586da920f3142932641d3fde825b10c6afca0";

test("HURC browser request is pinned to official Base funds page", () => {
  const request = buildHurcBrowserRequest();
  assert.equal(request.action, "scrape");
  assert.equal(request.url, "https://docs.base.org/get-started/get-funds");
  assert.equal(request.steps.length, 0);
});

test("HURC faucet step one is pinned to QuickNode Base Sepolia and the signer address", () => {
  const request = buildHurcFaucetStepOneRequest(SIGNER);
  assert.equal(HURC_QUICKNODE_FAUCET_URL, "https://faucet.quicknode.com/base/sepolia");
  assert.equal(request.action, "interact");
  assert.equal(request.url, HURC_QUICKNODE_FAUCET_URL);
  assert.deepEqual(request.steps, [
    {type:"type", selector:"#wallet", text:SIGNER},
    {type:"click", selector:'button[name="_action"][value="step-one"]'},
    {type:"wait", ms:1500},
  ]);
});

test("HURC faucet step one rejects arbitrary or zero addresses", () => {
  assert.throws(() => buildHurcFaucetStepOneRequest("https://evil.example"), /address/i);
  assert.throws(
    () => buildHurcFaucetStepOneRequest("0x0000000000000000000000000000000000000000"),
    /zero/i,
  );
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

test("HURC browser adapter can route the pinned faucet request without changing the gateway", async () => {
  let seen;
  const request = buildHurcFaucetStepOneRequest(SIGNER);
  const fetchImpl = async (url, init) => {
    seen = {url, init};
    return {
      ok: true,
      status: 200,
      async text() { return JSON.stringify({ok:true, traceId:"faucet-test"}); },
    };
  };

  await callHerculesBrowser(fetchImpl, {
    supabaseUrl: "https://example.supabase.co",
    internalKey: "server-only",
    request,
  });

  assert.equal(seen.url, "https://example.supabase.co/functions/v1/hercules-browser");
  assert.deepEqual(JSON.parse(seen.init.body), request);
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


test("QuickNode address-only preparation is fixed to Base Sepolia and the public signer", async () => {
  const {HURC_QUICKNODE_FAUCET_URL} = await import("../hercules-hurc/browser-adapter.mjs");
  assert.equal(HURC_QUICKNODE_FAUCET_URL, "https://faucet.quicknode.com/base/sepolia");

  const address = "0xa38586da920f3142932641d3fde825b10c6afca0";
  const request = buildHurcBrowserRequest({
    action: "prepare_quicknode",
    address,
  });

  assert.equal(request.action, "interact");
  assert.equal(request.url, HURC_QUICKNODE_FAUCET_URL);
  assert.deepEqual(request.steps, [
    {type:"type", selector:'input[placeholder="0x..."]', text:address},
    {type:"wait", ms:750},
  ]);
  assert.equal(JSON.stringify(request).includes("privateKey"), false);
  assert.equal(JSON.stringify(request).includes("mnemonic"), false);
});

test("QuickNode preparation rejects non-EVM public addresses", () => {
  assert.throws(
    () => buildHurcBrowserRequest({action:"prepare_quicknode", address:"not-an-address"}),
    /invalid HURC test signer address/,
  );
});
