import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {HerculesBankRuntime} from "../hercules-bank/runtime.mjs";

test("runtime persists customer ownership and balances across restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-bank-runtime-"));
  const statePath = join(root, "bank.json");
  try {
    const first = await HerculesBankRuntime.open({statePath,currency:"USD"});
    const alice = await first.openCustomerAccount({customerId:"user-alice"});
    const bob = await first.openCustomerAccount({customerId:"user-bob"});
    await first.fundSandboxAccount({
      accountId:alice.id,
      amountMinor:7500,
      idempotencyKey:"fund-alice",
    });
    await first.transfer({
      fromAccountId:alice.id,
      toAccountId:bob.id,
      amountMinor:2200,
      idempotencyKey:"alice-bob",
      reference:"sandbox transfer",
    });

    const reopened = await HerculesBankRuntime.open({statePath,currency:"USD"});
    assert.equal(reopened.getAccount(alice.id).customerId, "user-alice");
    assert.equal(reopened.getAccount(alice.id).balanceMinor, 5300);
    assert.equal(reopened.getAccount(bob.id).customerId, "user-bob");
    assert.equal(reopened.getAccount(bob.id).balanceMinor, 2200);
    assert.equal(reopened.listAccountsForCustomer("user-alice").length, 1);
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});

test("concurrent durable transfers are serialized and cannot overspend", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-bank-runtime-"));
  const statePath = join(root, "bank.json");
  try {
    const bank = await HerculesBankRuntime.open({statePath,currency:"USD"});
    const alice = await bank.openCustomerAccount({customerId:"user-alice"});
    const bob = await bank.openCustomerAccount({customerId:"user-bob"});
    await bank.fundSandboxAccount({
      accountId:alice.id,
      amountMinor:1000,
      idempotencyKey:"fund",
    });

    const results = await Promise.allSettled([
      bank.transfer({
        fromAccountId:alice.id,
        toAccountId:bob.id,
        amountMinor:700,
        idempotencyKey:"send-a",
      }),
      bank.transfer({
        fromAccountId:alice.id,
        toAccountId:bob.id,
        amountMinor:700,
        idempotencyKey:"send-b",
      }),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(bank.getAccount(alice.id).balanceMinor, 300);
    assert.equal(bank.getAccount(bob.id).balanceMinor, 700);

    const reopened = await HerculesBankRuntime.open({statePath,currency:"USD"});
    assert.equal(reopened.getAccount(alice.id).balanceMinor, 300);
    assert.equal(reopened.getAccount(bob.id).balanceMinor, 700);
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});
