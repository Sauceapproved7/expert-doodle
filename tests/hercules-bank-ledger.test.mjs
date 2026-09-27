import test from "node:test";
import assert from "node:assert/strict";

import {
  HerculesBankLedger,
  verifyJournalChain,
} from "../hercules-bank/ledger.mjs";

function buildLedger() {
  const ledger = new HerculesBankLedger({currency:"USD"});
  ledger.createAccount({id:"system:cash",normalSide:"DEBIT",allowNegative:true});
  ledger.createAccount({id:"customer:alice",normalSide:"CREDIT",allowNegative:false});
  ledger.createAccount({id:"customer:bob",normalSide:"CREDIT",allowNegative:false});
  return ledger;
}

test("journal postings must balance debits and credits", () => {
  const ledger = buildLedger();
  assert.throws(
    () => ledger.post({
      idempotencyKey:"unbalanced-1",
      reference:"invalid posting",
      entries:[
        {accountId:"system:cash",side:"DEBIT",amountMinor:1000},
        {accountId:"customer:alice",side:"CREDIT",amountMinor:999},
      ],
    }),
    /balanced/i,
  );
});

test("minor-unit amounts must be positive safe integers", () => {
  const ledger = buildLedger();
  for (const amountMinor of [0, -1, 10.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => ledger.post({
        idempotencyKey:"invalid-" + String(amountMinor),
        reference:"invalid amount",
        entries:[
          {accountId:"system:cash",side:"DEBIT",amountMinor},
          {accountId:"customer:alice",side:"CREDIT",amountMinor},
        ],
      }),
      /amount/i,
    );
  }
});

test("funding and internal customer transfer preserve balanced accounting", () => {
  const ledger = buildLedger();

  ledger.post({
    idempotencyKey:"fund-alice",
    reference:"sandbox funding",
    entries:[
      {accountId:"system:cash",side:"DEBIT",amountMinor:5000},
      {accountId:"customer:alice",side:"CREDIT",amountMinor:5000},
    ],
  });

  ledger.transferCustomerLiability({
    idempotencyKey:"alice-to-bob",
    fromAccountId:"customer:alice",
    toAccountId:"customer:bob",
    amountMinor:1800,
    reference:"sandbox transfer",
  });

  assert.equal(ledger.balance("customer:alice"), 3200);
  assert.equal(ledger.balance("customer:bob"), 1800);
  assert.equal(ledger.balance("system:cash"), 5000);
  assert.equal(ledger.transactions().length, 2);
  assert.equal(verifyJournalChain(ledger.transactions()), true);
});

test("customer liability accounts fail closed on overdraft", () => {
  const ledger = buildLedger();

  ledger.post({
    idempotencyKey:"fund-alice-small",
    reference:"sandbox funding",
    entries:[
      {accountId:"system:cash",side:"DEBIT",amountMinor:1000},
      {accountId:"customer:alice",side:"CREDIT",amountMinor:1000},
    ],
  });

  assert.throws(
    () => ledger.transferCustomerLiability({
      idempotencyKey:"overdraft",
      fromAccountId:"customer:alice",
      toAccountId:"customer:bob",
      amountMinor:1001,
      reference:"must fail",
    }),
    /negative|funds|overdraft/i,
  );

  assert.equal(ledger.balance("customer:alice"), 1000);
  assert.equal(ledger.balance("customer:bob"), 0);
  assert.equal(ledger.transactions().length, 1);
});

test("idempotent replay returns the original transaction without double posting", () => {
  const ledger = buildLedger();
  const request = {
    idempotencyKey:"fund-once",
    reference:"sandbox funding",
    entries:[
      {accountId:"system:cash",side:"DEBIT",amountMinor:2500},
      {accountId:"customer:alice",side:"CREDIT",amountMinor:2500},
    ],
  };

  const first = ledger.post(request);
  const second = ledger.post(request);

  assert.strictEqual(second, first);
  assert.equal(ledger.transactions().length, 1);
  assert.equal(ledger.balance("customer:alice"), 2500);
});

test("reusing an idempotency key with different economics is rejected", () => {
  const ledger = buildLedger();

  ledger.post({
    idempotencyKey:"same-key",
    reference:"sandbox funding",
    entries:[
      {accountId:"system:cash",side:"DEBIT",amountMinor:2500},
      {accountId:"customer:alice",side:"CREDIT",amountMinor:2500},
    ],
  });

  assert.throws(
    () => ledger.post({
      idempotencyKey:"same-key",
      reference:"changed funding",
      entries:[
        {accountId:"system:cash",side:"DEBIT",amountMinor:2600},
        {accountId:"customer:alice",side:"CREDIT",amountMinor:2600},
      ],
    }),
    /idempotency/i,
  );
});

test("a journal cannot mix account currencies", () => {
  const ledger = buildLedger();
  ledger.createAccount({id:"customer:eur",currency:"EUR",normalSide:"CREDIT",allowNegative:false});

  assert.throws(
    () => ledger.post({
      idempotencyKey:"currency-mix",
      reference:"must fail",
      entries:[
        {accountId:"system:cash",side:"DEBIT",amountMinor:1000},
        {accountId:"customer:eur",side:"CREDIT",amountMinor:1000},
      ],
    }),
    /currency/i,
  );
});
