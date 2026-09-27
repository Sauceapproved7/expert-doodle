import test from "node:test";
import assert from "node:assert/strict";
import {
  SHOPIFY_DNS_RECORDS,
  SpaceshipDnsClient,
  createSpaceshipDnsClientFromEnv,
  planShopifyDnsReconciliation,
} from "../hercules-deploy/spaceship-dns.mjs";

test("Shopify DNS contract is exact and limited to web routing records", () => {
  assert.deepEqual(SHOPIFY_DNS_RECORDS, [
    {type:"A", name:"@", address:"23.227.38.65", ttl:3600},
    {type:"AAAA", name:"@", address:"2620:0127:f00f:5::", ttl:3600},
    {type:"CNAME", name:"www", address:"shops.myshopify.com", ttl:3600},
  ]);
});

test("reconciliation preserves unrelated mail and TXT records", () => {
  const existing = [
    {type:"A", name:"@", address:"192.0.2.10", ttl:3600},
    {type:"CNAME", name:"www", address:"parking.example", ttl:3600},
    {type:"MX", name:"@", address:"mx.example", ttl:3600, priority:10},
    {type:"TXT", name:"@", address:"v=spf1 -all", ttl:3600},
  ];

  const plan = planShopifyDnsReconciliation(existing);
  assert.deepEqual(plan.deleteRecords, [
    {type:"A", name:"@", address:"192.0.2.10"},
    {type:"CNAME", name:"www", address:"parking.example"},
  ]);
  assert.equal(plan.saveRecords.length, 3);
  assert.equal(plan.unchanged.length, 2);
  assert.equal(plan.ready, false);
});

test("reconciliation is idempotent once Shopify records are present", () => {
  const plan = planShopifyDnsReconciliation(SHOPIFY_DNS_RECORDS);
  assert.equal(plan.ready, true);
  assert.deepEqual(plan.deleteRecords, []);
  assert.deepEqual(plan.saveRecords, []);
});

test("Spaceship client uses API headers without returning credentials", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({url, init});
    return new Response(JSON.stringify({items:[], total:0}), {
      status:200,
      headers:{"content-type":"application/json"},
    });
  };
  const client = new SpaceshipDnsClient({
    apiKey:"key_test",
    apiSecret:"secret_test",
    fetchImpl,
  });
  const result = await client.listRecords("sauceapproved.com");
  assert.equal(result.total, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers["X-API-Key"], "key_test");
  assert.equal(calls[0].init.headers["X-API-Secret"], "secret_test");
  assert.equal(JSON.stringify(result).includes("secret_test"), false);
});

test("Shopify reconciliation deletes only conflicting managed records, saves desired records, then verifies", async () => {
  const calls = [];
  let getCount = 0;
  const finalRecords = [
    ...SHOPIFY_DNS_RECORDS,
    {type:"MX", name:"@", address:"mx.example", ttl:3600},
  ];
  const fetchImpl = async (url, init = {}) => {
    calls.push({url, init});
    const method = init.method || "GET";
    if (method === "GET") {
      getCount += 1;
      const items = getCount === 1
        ? [
            {type:"A", name:"@", address:"192.0.2.10", ttl:3600},
            {type:"MX", name:"@", address:"mx.example", ttl:3600},
          ]
        : finalRecords;
      return new Response(JSON.stringify({items, total:items.length}), {status:200});
    }
    return new Response(null, {status:204});
  };

  const client = new SpaceshipDnsClient({
    apiKey:"key_test",
    apiSecret:"secret_test",
    fetchImpl,
  });
  const result = await client.reconcileShopify("sauceapproved.com");

  assert.equal(result.verified, true);
  assert.equal(result.changed, 4);
  assert.equal(calls.filter((call) => (call.init.method || "GET") === "DELETE").length, 1);
  assert.equal(calls.filter((call) => call.init.method === "PUT").length, 1);

  const deleteCall = calls.find((call) => call.init.method === "DELETE");
  assert.deepEqual(JSON.parse(deleteCall.init.body), [
    {type:"A", name:"@", address:"192.0.2.10"},
  ]);

  const saveCall = calls.find((call) => call.init.method === "PUT");
  const saved = JSON.parse(saveCall.init.body);
  assert.equal(saved.force, false);
  assert.equal(saved.items.length, 3);
});

test("environment factory fails closed when Spaceship credentials are absent", () => {
  assert.equal(createSpaceshipDnsClientFromEnv({}), null);
});
