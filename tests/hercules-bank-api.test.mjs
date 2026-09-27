import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {signJwtHs256} from "../hercules-base/auth-core.mjs";
import {createHerculesBankApi} from "../hercules-bank/api.mjs";
import {HerculesBankRuntime} from "../hercules-bank/runtime.mjs";

const JWT_SECRET = Buffer.alloc(48, 77).toString("hex");
const ISSUER = "hercules-base";
const AUDIENCE = "hercules-base-api";

function token(sub, role = "staging_user") {
  return signJwtHs256({
    sub,
    role,
    issuer:ISSUER,
    audience:AUDIENCE,
    ttlSeconds:900,
    nowSeconds:1000,
  }, JWT_SECRET);
}

async function request(base, path, {method="GET", bearer, body} = {}) {
  const headers = {};
  if (bearer) headers.authorization = "Bearer " + bearer;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(base + path, {
    method,
    headers,
    body:body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  return {response, payload};
}

test("bank API requires a valid Hercules access token", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-bank-api-"));
  try {
    const runtime = await HerculesBankRuntime.open({statePath:join(root,"bank.json")});
    const api = createHerculesBankApi({
      runtime,
      jwtSecret:JWT_SECRET,
      issuer:ISSUER,
      audience:AUDIENCE,
      nowSeconds:() => 1100,
    });
    await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + api.address().port;

    const health = await request(base, "/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.payload.mode, "SANDBOX");

    const unauthenticated = await request(base, "/v1/accounts");
    assert.equal(unauthenticated.response.status, 401);

    const authenticated = await request(base, "/v1/accounts", {
      bearer:token("user-alice"),
    });
    assert.equal(authenticated.response.status, 200);
    assert.deepEqual(authenticated.payload.accounts, []);

    await new Promise((resolve) => api.close(resolve));
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});

test("bank API binds account ownership to JWT subject and hides other customers", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-bank-api-"));
  try {
    const runtime = await HerculesBankRuntime.open({statePath:join(root,"bank.json")});
    const api = createHerculesBankApi({
      runtime,
      jwtSecret:JWT_SECRET,
      issuer:ISSUER,
      audience:AUDIENCE,
      nowSeconds:() => 1100,
    });
    await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + api.address().port;

    const opened = await request(base, "/v1/accounts", {
      method:"POST",
      bearer:token("user-alice"),
      body:{},
    });
    assert.equal(opened.response.status, 201);
    assert.equal(opened.payload.account.customerId, "user-alice");

    const own = await request(base, "/v1/accounts/" + encodeURIComponent(opened.payload.account.id), {
      bearer:token("user-alice"),
    });
    assert.equal(own.response.status, 200);

    const hidden = await request(base, "/v1/accounts/" + encodeURIComponent(opened.payload.account.id), {
      bearer:token("user-bob"),
    });
    assert.equal(hidden.response.status, 404);

    await new Promise((resolve) => api.close(resolve));
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});

test("sandbox funding is admin-only and customer transfers enforce source ownership", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-bank-api-"));
  try {
    const runtime = await HerculesBankRuntime.open({statePath:join(root,"bank.json")});
    const api = createHerculesBankApi({
      runtime,
      jwtSecret:JWT_SECRET,
      issuer:ISSUER,
      audience:AUDIENCE,
      nowSeconds:() => 1100,
    });
    await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + api.address().port;

    const alice = (await request(base, "/v1/accounts", {
      method:"POST",
      bearer:token("user-alice"),
      body:{},
    })).payload.account;
    const bob = (await request(base, "/v1/accounts", {
      method:"POST",
      bearer:token("user-bob"),
      body:{},
    })).payload.account;

    const deniedFunding = await request(base, "/v1/admin/fund-sandbox", {
      method:"POST",
      bearer:token("user-alice"),
      body:{accountId:alice.id,amountMinor:5000,idempotencyKey:"fund"},
    });
    assert.equal(deniedFunding.response.status, 403);

    const funded = await request(base, "/v1/admin/fund-sandbox", {
      method:"POST",
      bearer:token("operator-owner","owner"),
      body:{accountId:alice.id,amountMinor:5000,idempotencyKey:"fund"},
    });
    assert.equal(funded.response.status, 200);
    assert.equal(funded.payload.account.balanceMinor, 5000);

    const stolenSource = await request(base, "/v1/transfers", {
      method:"POST",
      bearer:token("user-bob"),
      body:{
        fromAccountId:alice.id,
        toAccountId:bob.id,
        amountMinor:1000,
        idempotencyKey:"steal",
      },
    });
    assert.equal(stolenSource.response.status, 404);

    const sent = await request(base, "/v1/transfers", {
      method:"POST",
      bearer:token("user-alice"),
      body:{
        fromAccountId:alice.id,
        toAccountId:bob.id,
        amountMinor:1250,
        idempotencyKey:"send",
        reference:"sandbox payment",
      },
    });
    assert.equal(sent.response.status, 200);
    assert.equal(sent.payload.from.balanceMinor, 3750);
    assert.equal(sent.payload.to.balanceMinor, 1250);

    await new Promise((resolve) => api.close(resolve));
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});

test("external payment rails remain hard-disabled at the API boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-bank-api-"));
  try {
    const runtime = await HerculesBankRuntime.open({statePath:join(root,"bank.json")});
    const api = createHerculesBankApi({
      runtime,
      jwtSecret:JWT_SECRET,
      issuer:ISSUER,
      audience:AUDIENCE,
      nowSeconds:() => 1100,
    });
    await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + api.address().port;

    const result = await request(base, "/v1/external-transfers", {
      method:"POST",
      bearer:token("operator-owner","owner"),
      body:{rail:"ACH",amountMinor:100},
    });
    assert.equal(result.response.status, 501);
    assert.equal(result.payload.error, "external_rails_disabled");

    await new Promise((resolve) => api.close(resolve));
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});
