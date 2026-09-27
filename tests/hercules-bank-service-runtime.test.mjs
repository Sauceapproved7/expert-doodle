import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {signJwtHs256} from "../hercules-base/auth-core.mjs";
import {HerculesBankClient} from "../hercules-bank/client.mjs";
import {startHerculesBankService} from "../hercules-bank/server.mjs";

const JWT_SECRET = Buffer.alloc(48, 91).toString("hex");

function bearer(sub, role = "staging_user") {
  return signJwtHs256({
    sub,
    role,
    issuer:"hercules-base",
    audience:"hercules-base-api",
    ttlSeconds:900,
    nowSeconds:1000,
  }, JWT_SECRET);
}

test("deployable bank service starts on loopback and preserves state across restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-bank-server-"));
  const statePath = join(root, "bank.json");
  try {
    const first = await startHerculesBankService({
      statePath,
      jwtSecret:JWT_SECRET,
      port:0,
      nowSeconds:() => 1100,
    });
    assert.match(first.endpoint, /^http:\/\/127\.0\.0\.1:\d+$/);

    const alice = new HerculesBankClient({
      endpoint:first.endpoint,
      tokenProvider:async () => bearer("user-alice"),
    });
    const opened = await alice.openAccount();
    assert.equal(opened.customerId, "user-alice");
    assert.equal(opened.balanceMinor, 0);

    await new Promise((resolve) => first.server.close(resolve));

    const second = await startHerculesBankService({
      statePath,
      jwtSecret:JWT_SECRET,
      port:0,
      nowSeconds:() => 1100,
    });
    const reopenedClient = new HerculesBankClient({
      endpoint:second.endpoint,
      tokenProvider:async () => bearer("user-alice"),
    });
    const accounts = await reopenedClient.listAccounts();
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].id, opened.id);

    await new Promise((resolve) => second.server.close(resolve));
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});

test("first-party bank client sends bearer tokens and exposes account/transfer operations", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-bank-client-"));
  try {
    const service = await startHerculesBankService({
      statePath:join(root, "bank.json"),
      jwtSecret:JWT_SECRET,
      port:0,
      nowSeconds:() => 1100,
    });

    const alice = new HerculesBankClient({
      endpoint:service.endpoint,
      tokenProvider:async () => bearer("user-alice"),
    });
    const bob = new HerculesBankClient({
      endpoint:service.endpoint,
      tokenProvider:async () => bearer("user-bob"),
    });
    const admin = new HerculesBankClient({
      endpoint:service.endpoint,
      tokenProvider:async () => bearer("operator-owner", "owner"),
    });

    const aliceAccount = await alice.openAccount();
    const bobAccount = await bob.openAccount();
    const funded = await admin.fundSandbox({
      accountId:aliceAccount.id,
      amountMinor:9000,
      idempotencyKey:"fund-alice",
    });
    assert.equal(funded.balanceMinor, 9000);

    const transfer = await alice.transfer({
      fromAccountId:aliceAccount.id,
      toAccountId:bobAccount.id,
      amountMinor:2400,
      idempotencyKey:"alice-bob",
      reference:"sandbox pay",
    });
    assert.equal(transfer.from.balanceMinor, 6600);
    assert.equal(transfer.to.balanceMinor, 2400);

    const statement = await alice.statement(aliceAccount.id);
    assert.equal(statement.balanceMinor, 6600);
    assert.equal(statement.entries.length, 2);

    await new Promise((resolve) => service.server.close(resolve));
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});

test("bank client fails closed when token provider returns no access token", async () => {
  const client = new HerculesBankClient({
    endpoint:"http://127.0.0.1:1",
    tokenProvider:async () => "",
  });
  await assert.rejects(() => client.listAccounts(), /access token/i);
});

test("bank service rejects missing or weak JWT configuration before listening", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-bank-server-"));
  try {
    await assert.rejects(
      () => startHerculesBankService({
        statePath:join(root, "bank.json"),
        jwtSecret:"short",
        port:0,
      }),
      /JWT secret/i,
    );
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});


test("bank client rejects cleartext remote endpoints", () => {
  assert.throws(
    () => new HerculesBankClient({
      endpoint:"http://example.com",
      tokenProvider:async () => bearer("user-alice"),
    }),
    /HTTPS|loopback/i,
  );
});
