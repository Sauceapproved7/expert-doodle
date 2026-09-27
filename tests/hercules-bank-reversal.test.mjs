import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {signJwtHs256} from "../hercules-base/auth-core.mjs";
import {createHerculesBankApi} from "../hercules-bank/api.mjs";
import {HerculesBankClient} from "../hercules-bank/client.mjs";
import {HerculesBankLedger, verifyJournalChain} from "../hercules-bank/ledger.mjs";
import {HerculesBankRuntime} from "../hercules-bank/runtime.mjs";

const JWT_SECRET = Buffer.alloc(48, 66).toString("hex");

function token(sub, role = "staging_user") {
  return signJwtHs256({
    sub,
    role,
    issuer:"hercules-base",
    audience:"hercules-base-api",
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
  return {response, payload:await response.json()};
}

test("ledger reverses a transaction by posting an immutable inverse journal entry", () => {
  const ledger = new HerculesBankLedger({currency:"USD"});
  ledger.createAccount({id:"system:cash",currency:"USD",normalSide:"DEBIT",allowNegative:true});
  ledger.createAccount({id:"customer:alice",currency:"USD",normalSide:"CREDIT",allowNegative:false});

  const funding = ledger.post({
    idempotencyKey:"fund-1",
    reference:"sandbox funding",
    entries:[
      {accountId:"system:cash",side:"DEBIT",amountMinor:5000},
      {accountId:"customer:alice",side:"CREDIT",amountMinor:5000},
    ],
  });

  const reversal = ledger.reverseTransaction({
    transactionHash:funding.hash,
    idempotencyKey:"reverse-fund-1",
    reason:"operator correction",
  });

  assert.equal(ledger.balance("customer:alice"), 0);
  assert.equal(reversal.entries[0].side, "CREDIT");
  assert.equal(reversal.entries[1].side, "DEBIT");
  assert.match(reversal.reference, new RegExp("reversal-of:" + funding.hash));
  assert.equal(verifyJournalChain(ledger.transactions()), true);
});

test("ledger prevents the same transaction from being reversed twice", () => {
  const ledger = new HerculesBankLedger({currency:"USD"});
  ledger.createAccount({id:"system:cash",currency:"USD",normalSide:"DEBIT",allowNegative:true});
  ledger.createAccount({id:"customer:alice",currency:"USD",normalSide:"CREDIT",allowNegative:false});

  const funding = ledger.post({
    idempotencyKey:"fund-2",
    reference:"sandbox funding",
    entries:[
      {accountId:"system:cash",side:"DEBIT",amountMinor:1000},
      {accountId:"customer:alice",side:"CREDIT",amountMinor:1000},
    ],
  });

  const first = ledger.reverseTransaction({
    transactionHash:funding.hash,
    idempotencyKey:"reverse-once",
    reason:"correction",
  });
  const replay = ledger.reverseTransaction({
    transactionHash:funding.hash,
    idempotencyKey:"reverse-once",
    reason:"correction",
  });
  assert.equal(replay.hash, first.hash);

  assert.throws(() => ledger.reverseTransaction({
    transactionHash:funding.hash,
    idempotencyKey:"reverse-twice",
    reason:"second attempt",
  }), /already reversed/i);
});

test("runtime persists transaction reversals across restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-bank-reversal-"));
  const statePath = join(root, "bank.json");
  try {
    const bank = await HerculesBankRuntime.open({statePath,currency:"USD"});
    const alice = await bank.openCustomerAccount({customerId:"user-alice"});
    await bank.fundSandboxAccount({
      accountId:alice.id,
      amountMinor:3200,
      idempotencyKey:"fund-runtime",
    });
    const original = bank.journal().at(-1);

    await bank.reverseTransaction({
      transactionHash:original.hash,
      idempotencyKey:"reverse-runtime",
      reason:"sandbox correction",
    });
    assert.equal(bank.getAccount(alice.id).balanceMinor, 0);

    const reopened = await HerculesBankRuntime.open({statePath,currency:"USD"});
    assert.equal(reopened.getAccount(alice.id).balanceMinor, 0);
    assert.equal(reopened.journal().length, 2);
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});

test("reversal API is admin-only and first-party client can execute it", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-bank-reversal-api-"));
  let api;
  try {
    const runtime = await HerculesBankRuntime.open({statePath:join(root,"bank.json")});
    api = createHerculesBankApi({
      runtime,
      jwtSecret:JWT_SECRET,
      nowSeconds:() => 1100,
    });
    await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + api.address().port;

    const opened = await request(base, "/v1/accounts", {
      method:"POST",
      bearer:token("user-alice"),
      body:{},
    });
    const account = opened.payload.account;

    await request(base, "/v1/admin/fund-sandbox", {
      method:"POST",
      bearer:token("operator-owner","owner"),
      body:{accountId:account.id,amountMinor:4400,idempotencyKey:"fund-api"},
    });
    const original = runtime.journal().at(-1);

    const denied = await request(base, "/v1/admin/reversals", {
      method:"POST",
      bearer:token("user-alice"),
      body:{transactionHash:original.hash,idempotencyKey:"reverse-denied",reason:"no"},
    });
    assert.equal(denied.response.status, 403);

    const admin = new HerculesBankClient({
      endpoint:base,
      tokenProvider:async () => token("operator-owner","owner"),
    });
    const reversed = await admin.reverseSandboxTransaction({
      transactionHash:original.hash,
      idempotencyKey:"reverse-api",
      reason:"operator correction",
    });

    assert.equal(reversed.transaction.reversalOf, original.hash);
    assert.equal(runtime.getAccount(account.id).balanceMinor, 0);
  } finally {
    if (api?.listening) await new Promise((resolve) => api.close(resolve));
    await rm(root, {recursive:true, force:true});
  }
});
