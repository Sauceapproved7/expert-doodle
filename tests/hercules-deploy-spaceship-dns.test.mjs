import assert from "node:assert/strict";
import test from "node:test";
import {
  SHOPIFY_DNS_RECORDS,
  SpaceshipDnsClient,
  buildShopifyDnsPlan,
} from "../hercules-deploy/spaceship-dns.mjs";

test("Shopify DNS target is pinned to current required records", () => {
  assert.deepEqual(SHOPIFY_DNS_RECORDS, [
    {type:"A", name:"@", address:"23.227.38.65", ttl:3600},
    {type:"AAAA", name:"@", address:"2620:0127:f00f:5::", ttl:3600},
    {type:"CNAME", name:"www", cname:"shops.myshopify.com", ttl:3600},
  ]);
});

test("planner preserves unrelated records and reports custom conflicts", () => {
  const plan = buildShopifyDnsPlan([
    {type:"MX", name:"@", exchange:"mx.example.test", preference:10, group:"custom"},
    {type:"A", name:"@", address:"192.0.2.10", ttl:300, group:"custom"},
    {type:"CNAME", name:"www", cname:"old.example.test", ttl:300, group:"custom"},
  ]);
  assert.equal(plan.safeToApply, true);
  assert.equal(plan.customConflicts.length, 2);
  assert.equal(plan.blockingConflicts.length, 0);
  assert.equal(plan.missing.length, 3);
});

test("provider-managed conflicting records fail closed", () => {
  const plan = buildShopifyDnsPlan([
    {type:"A", name:"@", address:"192.0.2.10", group:"product"},
  ]);
  assert.equal(plan.safeToApply, false);
  assert.equal(plan.blockingConflicts.length, 1);
});

test("client is domain allowlisted and sends credentials only as headers", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({url, init});
    return new Response(JSON.stringify({items:[]}), {
      status:200,
      headers:{"content-type":"application/json"},
    });
  };
  const client = new SpaceshipDnsClient({
    apiKey:"key_test",
    apiSecret:"secret_test",
    allowedDomains:["sauceapproved.com"],
    fetchImpl,
  });
  await client.listRecords("sauceapproved.com");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].init.headers["X-API-Key"], "key_test");
  assert.equal(seen[0].init.headers["X-API-Secret"], "secret_test");
  assert.ok(!seen[0].url.includes("key_test"));
  assert.throws(() => client.assertAllowed("example.com"), /not allowlisted/);
});

test("reconcile deletes only conflicting target records, writes missing Shopify records, then verifies", async () => {
  const calls = [];
  let records = [
    {type:"A", name:"@", address:"192.0.2.10", group:"custom"},
    {type:"TXT", name:"@", value:"preserve-me", group:"custom"},
  ];
  const fetchImpl = async (url, init) => {
    const method = init.method || "GET";
    calls.push({url, method, body:init.body});
    if (method === "GET") {
      return new Response(JSON.stringify({items:records}), {status:200});
    }
    if (method === "DELETE") {
      const deleting = JSON.parse(init.body);
      records = records.filter((record) => !deleting.some((item) =>
        item.type === record.type && item.name === record.name &&
        (item.address ?? item.cname) === (record.address ?? record.cname)
      ));
      return new Response(null, {status:204});
    }
    if (method === "PUT") {
      const payload = JSON.parse(init.body);
      records.push(...payload.items.map((item) => ({...item, group:"custom"})));
      return new Response(null, {status:204});
    }
    throw new Error("unexpected method");
  };

  const client = new SpaceshipDnsClient({
    apiKey:"key_test",
    apiSecret:"secret_test",
    allowedDomains:["sauceapproved.com"],
    fetchImpl,
  });
  const result = await client.reconcileShopify("sauceapproved.com", {replaceCustomConflicts:true});
  assert.equal(result.status, "ready");
  assert.equal(result.changed, true);
  assert.equal(result.verification.missing.length, 0);
  assert.equal(result.verification.conflicts.length, 0);
  assert.ok(records.some((record) => record.type === "TXT" && record.value === "preserve-me"));
  assert.ok(calls.some((call) => call.method === "DELETE"));
  assert.ok(calls.some((call) => call.method === "PUT"));
});
