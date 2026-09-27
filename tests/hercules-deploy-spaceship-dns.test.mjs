import test from "node:test";
import assert from "node:assert/strict";
import {
  SHOPIFY_DNS_RECORDS,
  RESEND_MAIL_DNS_RECORDS,
  SpaceshipDnsClient,
  createSpaceshipDnsClientFromEnv,
  planShopifyDnsReconciliation,
  planResendMailDnsReconciliation,
} from "../hercules-deploy/spaceship-dns.mjs";

test("Shopify DNS contract uses official type-specific fields", () => {
  assert.deepEqual(SHOPIFY_DNS_RECORDS, [
    {type:"A", name:"@", address:"23.227.38.65", ttl:3600},
    {type:"AAAA", name:"@", address:"2620:0127:f00f:5::", ttl:3600},
    {type:"CNAME", name:"www", cname:"shops.myshopify.com", ttl:3600},
  ]);
});

test("planner preserves unrelated real DNS shapes and reports custom conflicts", () => {
  const existing = [
    {type:"A", name:"@", address:"192.0.2.10", ttl:300, group:{type:"custom"}},
    {type:"CNAME", name:"www", cname:"parking.example", ttl:300, group:{type:"custom"}},
    {type:"MX", name:"@", exchange:"mx.example", preference:10, ttl:3600, group:{type:"custom"}},
    {type:"TXT", name:"@", value:"v=spf1 -all", ttl:3600, group:{type:"custom"}},
  ];
  const plan = planShopifyDnsReconciliation(existing);
  assert.equal(plan.safeToApply, true);
  assert.deepEqual(plan.deleteRecords, [
    {type:"A", name:"@", address:"192.0.2.10"},
    {type:"CNAME", name:"www", cname:"parking.example"},
  ]);
  assert.equal(plan.saveRecords.length, 3);
  assert.equal(plan.unchanged.length, 2);
  assert.equal(plan.ready, false);
});

test("provider-managed and unknown conflicting records fail closed", () => {
  for (const record of [
    {type:"A", name:"@", address:"192.0.2.10", group:{type:"product"}},
    {type:"A", name:"@", address:"192.0.2.10"},
  ]) {
    const plan = planShopifyDnsReconciliation([record]);
    assert.equal(plan.safeToApply, false);
    assert.equal(plan.blockingConflicts.length, 1);
    assert.equal(plan.deleteRecords.length, 0);
  }
});

test("reconciliation is idempotent once Shopify records are present", () => {
  const existing = SHOPIFY_DNS_RECORDS.map((record) => ({...record, group:{type:"custom"}}));
  const plan = planShopifyDnsReconciliation(existing);
  assert.equal(plan.ready, true);
  assert.deepEqual(plan.deleteRecords, []);
  assert.deepEqual(plan.saveRecords, []);
});

test("client allowlists domains and sends credentials only in headers", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({url, init});
    return new Response(JSON.stringify({items:[], total:0}), {status:200});
  };
  const client = new SpaceshipDnsClient({
    apiKey:"key_test",
    apiSecret:"secret_test",
    allowedDomains:["sauceapproved.com"],
    fetchImpl,
  });
  const result = await client.listRecords("sauceapproved.com");
  assert.equal(result.total, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers["X-API-Key"], "key_test");
  assert.equal(calls[0].init.headers["X-API-Secret"], "secret_test");
  assert.equal(calls[0].url.includes("secret_test"), false);
  assert.throws(() => client.assertAllowed("example.com"), /not allowlisted/);
});

test("record listing paginates until provider total is complete", async () => {
  const calls = [];
  const first = Array.from({length:500}, (_, i) => ({
    type:"TXT", name:"r" + i, value:"v", group:{type:"custom"},
  }));
  const second = [{type:"TXT", name:"last", value:"v", group:{type:"custom"}}];
  const fetchImpl = async (url, init = {}) => {
    calls.push({url, init});
    const skip = Number(new URL(url).searchParams.get("skip"));
    const items = skip === 0 ? first : second;
    return new Response(JSON.stringify({items, total:501}), {status:200});
  };
  const client = new SpaceshipDnsClient({
    apiKey:"key_test", apiSecret:"secret_test",
    allowedDomains:["sauceapproved.com"], fetchImpl,
  });
  const result = await client.listRecords("sauceapproved.com");
  assert.equal(result.items.length, 501);
  assert.equal(result.total, 501);
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /skip=500/);
});

test("custom target conflicts require explicit replacement before mutation", async () => {
  const calls = [];
  const records = [
    {type:"A", name:"@", address:"192.0.2.10", ttl:300, group:{type:"custom"}},
  ];
  const fetchImpl = async (url, init = {}) => {
    calls.push({url, init});
    return new Response(JSON.stringify({items:records, total:records.length}), {status:200});
  };
  const client = new SpaceshipDnsClient({
    apiKey:"key_test", apiSecret:"secret_test",
    allowedDomains:["sauceapproved.com"], fetchImpl,
  });
  const result = await client.reconcileShopify("sauceapproved.com");
  assert.equal(result.status, "conflict");
  assert.equal(result.changed, false);
  assert.equal(calls.length, 1);
});

test("Shopify reconciliation replaces only custom target conflicts and verifies", async () => {
  const calls = [];
  let records = [
    {type:"A", name:"@", address:"192.0.2.10", ttl:300, group:{type:"custom"}},
    {type:"TXT", name:"@", value:"preserve-me", ttl:3600, group:{type:"custom"}},
  ];
  const fetchImpl = async (url, init = {}) => {
    const method = init.method || "GET";
    calls.push({url, init});
    if (method === "GET") {
      return new Response(JSON.stringify({items:records, total:records.length}), {status:200});
    }
    if (method === "DELETE") {
      const deleting = JSON.parse(init.body);
      records = records.filter((record) => !deleting.some((item) =>
        item.type === record.type &&
        item.name === record.name &&
        (item.address ?? item.cname) === (record.address ?? record.cname)
      ));
      return new Response(null, {status:204});
    }
    if (method === "PUT") {
      const payload = JSON.parse(init.body);
      records.push(...payload.items.map((item) => ({...item, group:{type:"custom"}})));
      return new Response(null, {status:204});
    }
    throw new Error("unexpected method");
  };
  const client = new SpaceshipDnsClient({
    apiKey:"key_test", apiSecret:"secret_test",
    allowedDomains:["sauceapproved.com"], fetchImpl,
  });
  const result = await client.reconcileShopify("sauceapproved.com", {replaceCustomConflicts:true});
  assert.equal(result.status, "ready");
  assert.equal(result.verified, true);
  assert.ok(records.some((record) => record.type === "TXT" && record.value === "preserve-me"));
  const saveCall = calls.find((call) => call.init.method === "PUT");
  const saved = JSON.parse(saveCall.init.body);
  assert.equal(saved.force, false);
  assert.deepEqual(saved.items.find((record) => record.type === "CNAME"), {
    type:"CNAME", name:"www", cname:"shops.myshopify.com", ttl:3600,
  });
});

test("save rejects TTL outside Spaceship documented range before provider call", async () => {
  let called = false;
  const client = new SpaceshipDnsClient({
    apiKey:"key_test", apiSecret:"secret_test",
    allowedDomains:["sauceapproved.com"],
    fetchImpl:async () => { called = true; return new Response(null, {status:204}); },
  });
  await assert.rejects(
    client.saveRecords("sauceapproved.com", [{type:"A", name:"@", address:"23.227.38.65", ttl:7200}]),
    /TTL out of range/,
  );
  assert.equal(called, false);
});

test("environment factory fails closed without credentials and defaults to SauceApproved allowlist", async () => {
  assert.equal(createSpaceshipDnsClientFromEnv({}), null);
  const client = createSpaceshipDnsClientFromEnv({
    HERCULES_SPACESHIP_API_KEY:"key_test",
    HERCULES_SPACESHIP_API_SECRET:"secret_test",
  }, {
    fetchImpl:async () => new Response(JSON.stringify({items:[], total:0}), {status:200}),
  });
  await client.listRecords("sauceapproved.com");
  assert.throws(() => client.assertAllowed("example.com"), /not allowlisted/);
});


test("Resend business email DNS contract uses Spaceship type-specific fields", () => {
  assert.deepEqual(RESEND_MAIL_DNS_RECORDS, [
    {type:"TXT", name:"resend._domainkey", value:"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC6+i+jh2KU91qQnRldgoE2THb9mwmwTlE+fJhKF6nZyhxvZWd826LtIVc2vZHATG5uBu0X0TxkfyO9pJAOth022HQWHHZR1TcoqeZK9LAJ/S5Jw8yY1htY9UvkH2niGQYluGZ+zMKmlMzwcTc7zwu/Q3Wemmcjhku+dPtYsbweiQIDAQAB", ttl:3600},
    {type:"MX", name:"send", exchange:"feedback-smtp.us-east-1.amazonses.com", preference:10, ttl:3600},
    {type:"TXT", name:"send", value:"v=spf1 include:amazonses.com ~all", ttl:3600},
    {type:"CNAME", name:"rsend", cname:"send.forge.rmta.net", ttl:3600},
  ]);
});

test("Resend sending-only contract never manages apex inbound MX", () => {
  assert.equal(
    RESEND_MAIL_DNS_RECORDS.some((record) => record.type === "MX" && record.name === "@"),
    false,
  );
  const existing = [
    {type:"MX", name:"@", exchange:"mail.existing.example", preference:10, ttl:3600, group:{type:"custom"}},
  ];
  const plan = planResendMailDnsReconciliation(existing);
  assert.equal(plan.deleteRecords.length, 0);
  assert.equal(plan.blockingConflicts.length, 0);
  assert.equal(plan.unchanged.length, 1);
});

test("Resend mail planner preserves unrelated records and only targets exact mail keys", () => {
  const existing = [
    {type:"A", name:"@", address:"23.227.38.65", ttl:3600, group:{type:"custom"}},
    {type:"CNAME", name:"www", cname:"shops.myshopify.com", ttl:3600, group:{type:"custom"}},
    {type:"TXT", name:"@", value:"unrelated-verification=keep", ttl:3600, group:{type:"custom"}},
  ];
  const plan = planResendMailDnsReconciliation(existing);
  assert.equal(plan.safeToApply, true);
  assert.equal(plan.deleteRecords.length, 0);
  assert.equal(plan.saveRecords.length, 4);
  assert.equal(plan.unchanged.length, 3);
  assert.equal(plan.ready, false);
});

test("Resend mail planner fails closed on provider-managed conflicts and identifies custom replacements", () => {
  const providerConflict = planResendMailDnsReconciliation([
    {type:"CNAME", name:"rsend", cname:"mail.provider.example", ttl:3600, group:{type:"product"}},
  ]);
  assert.equal(providerConflict.safeToApply, false);
  assert.equal(providerConflict.blockingConflicts.length, 1);
  assert.equal(providerConflict.deleteRecords.length, 0);

  const customConflict = planResendMailDnsReconciliation([
    {type:"TXT", name:"send", value:"v=spf1 include:old.example ~all", ttl:3600, group:{type:"custom"}},
  ]);
  assert.equal(customConflict.safeToApply, true);
  assert.deepEqual(customConflict.deleteRecords, [
    {type:"TXT", name:"send", value:"v=spf1 include:old.example ~all"},
  ]);
});

test("client serializes TXT and MX records using official Spaceship fields", async () => {
  const calls = [];
  const client = new SpaceshipDnsClient({
    apiKey:"key_test",
    apiSecret:"secret_test",
    allowedDomains:["sauceapproved.com"],
    fetchImpl:async (url, init={}) => {
      calls.push({url,init});
      return new Response(null,{status:204});
    },
  });
  await client.saveRecords("sauceapproved.com", [
    {type:"TXT", name:"send", value:"v=spf1 include:amazonses.com ~all", ttl:3600},
    {type:"MX", name:"send", exchange:"feedback-smtp.us-east-1.amazonses.com", preference:10, ttl:3600},
  ]);
  const payload=JSON.parse(calls[0].init.body);
  assert.deepEqual(payload.items, [
    {type:"TXT", name:"send", value:"v=spf1 include:amazonses.com ~all", ttl:3600},
    {type:"MX", name:"send", exchange:"feedback-smtp.us-east-1.amazonses.com", preference:10, ttl:3600},
  ]);
});
