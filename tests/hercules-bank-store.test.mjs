import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {HerculesBankLedger} from "../hercules-bank/ledger.mjs";
import {
  HerculesBankStateStore,
  restoreLedgerFromSnapshot,
} from "../hercules-bank/store.mjs";

function fundedLedger() {
  const ledger = new HerculesBankLedger({currency:"USD"});
  ledger.createAccount({id:"system:cash",normalSide:"DEBIT",allowNegative:true});
  ledger.createAccount({id:"customer:a",normalSide:"CREDIT",allowNegative:false});
  ledger.post({
    idempotencyKey:"fund-a",
    reference:"sandbox funding",
    entries:[
      {accountId:"system:cash",side:"DEBIT",amountMinor:4000},
      {accountId:"customer:a",side:"CREDIT",amountMinor:4000},
    ],
  });
  return ledger;
}

test("ledger snapshot round-trips balances and journal identity", () => {
  const original = fundedLedger();
  const snapshot = original.snapshot();
  const restored = restoreLedgerFromSnapshot(snapshot);

  assert.equal(restored.balance("customer:a"), 4000);
  assert.equal(restored.transactions().length, 1);
  assert.deepEqual(restored.transactions(), original.transactions());
});

test("restoring a tampered snapshot fails closed", () => {
  const original = fundedLedger();
  const snapshot = structuredClone(original.snapshot());
  snapshot.transactions[0].entries[1].amountMinor = 3999;

  assert.throws(
    () => restoreLedgerFromSnapshot(snapshot),
    /integrity|balanced|hash|snapshot/i,
  );
});

test("state store writes atomically and reloads the verified snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-bank-store-"));
  try {
    const path = join(root, "bank-state.json");
    const store = new HerculesBankStateStore({path});
    const ledger = fundedLedger();

    await store.save(ledger.snapshot());
    const loaded = await store.load();
    const restored = restoreLedgerFromSnapshot(loaded);

    assert.equal(restored.balance("customer:a"), 4000);
    const raw = JSON.parse(await readFile(path, "utf8"));
    assert.equal(raw.schema, "sauceapproved.hercules.bank-ledger-snapshot");
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});

test("state store rejects malformed JSON without overwriting it", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-bank-store-"));
  try {
    const path = join(root, "bank-state.json");
    await writeFile(path, "{not-json", "utf8");
    const store = new HerculesBankStateStore({path});

    await assert.rejects(() => store.load(), /parse|json|state/i);
    assert.equal(await readFile(path, "utf8"), "{not-json");
  } finally {
    await rm(root, {recursive:true, force:true});
  }
});
