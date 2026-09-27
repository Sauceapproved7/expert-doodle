import test from "node:test";
import assert from "node:assert/strict";

import {HerculesBankSandbox} from "../hercules-bank/service.mjs";

test("sandbox opens a customer liability account with zero balance", () => {
  const bank = new HerculesBankSandbox({currency:"USD"});
  const account = bank.openCustomerAccount({customerId:"cust-1", accountId:"acct-1"});

  assert.equal(account.id, "acct-1");
  assert.equal(account.customerId, "cust-1");
  assert.equal(account.currency, "USD");
  assert.equal(bank.getAccount("acct-1").balanceMinor, 0);
  assert.equal(bank.mode, "SANDBOX");
});

test("sandbox funding creates balanced ledger value without external money movement", () => {
  const bank = new HerculesBankSandbox({currency:"USD"});
  bank.openCustomerAccount({customerId:"cust-1", accountId:"acct-1"});

  const funded = bank.fundSandboxAccount({
    accountId:"acct-1",
    amountMinor:12500,
    idempotencyKey:"sandbox-fund-1",
  });

  assert.equal(funded.balanceMinor, 12500);
  assert.equal(bank.getAccount("acct-1").balanceMinor, 12500);
  assert.equal(bank.journal().length, 1);
});

test("customer transfer moves liability value atomically", () => {
  const bank = new HerculesBankSandbox({currency:"USD"});
  bank.openCustomerAccount({customerId:"cust-1", accountId:"acct-1"});
  bank.openCustomerAccount({customerId:"cust-2", accountId:"acct-2"});
  bank.fundSandboxAccount({
    accountId:"acct-1",
    amountMinor:10000,
    idempotencyKey:"fund",
  });

  bank.transfer({
    fromAccountId:"acct-1",
    toAccountId:"acct-2",
    amountMinor:3750,
    idempotencyKey:"transfer-1",
    reference:"test payment",
  });

  assert.equal(bank.getAccount("acct-1").balanceMinor, 6250);
  assert.equal(bank.getAccount("acct-2").balanceMinor, 3750);
  assert.equal(bank.journal().length, 2);
});

test("account statements expose only entries for the requested account", () => {
  const bank = new HerculesBankSandbox({currency:"USD"});
  bank.openCustomerAccount({customerId:"cust-1", accountId:"acct-1"});
  bank.openCustomerAccount({customerId:"cust-2", accountId:"acct-2"});
  bank.fundSandboxAccount({accountId:"acct-1",amountMinor:5000,idempotencyKey:"fund"});
  bank.transfer({
    fromAccountId:"acct-1",
    toAccountId:"acct-2",
    amountMinor:1200,
    idempotencyKey:"send",
    reference:"sandbox send",
  });

  const statement = bank.statement("acct-2");

  assert.equal(statement.accountId, "acct-2");
  assert.equal(statement.balanceMinor, 1200);
  assert.equal(statement.entries.length, 1);
  assert.equal(statement.entries[0].reference, "sandbox send");
  assert.equal(statement.entries[0].side, "CREDIT");
  assert.equal(statement.entries[0].amountMinor, 1200);
});

test("the sandbox refuses external rail operations", () => {
  const bank = new HerculesBankSandbox({currency:"USD"});

  assert.throws(
    () => bank.requestExternalTransfer({rail:"ACH",amountMinor:100}),
    /sandbox|external|disabled/i,
  );
});
