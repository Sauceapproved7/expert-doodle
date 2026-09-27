import {randomUUID} from "node:crypto";
import {mkdir, readFile, rename, rm, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";

import {HerculesBankLedger, verifyJournalChain} from "./ledger.mjs";

const SNAPSHOT_SCHEMA = "sauceapproved.hercules.bank-ledger-snapshot";
const SNAPSHOT_VERSION = 1;

function nonEmpty(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(label + " must be a non-empty string");
  }
  return value.trim();
}

function clone(value) {
  return structuredClone(value);
}

function assertSnapshotShape(snapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new TypeError("bank snapshot must be an object");
  if (snapshot.schema !== SNAPSHOT_SCHEMA) throw new Error("bank snapshot schema mismatch");
  if (snapshot.version !== SNAPSHOT_VERSION) throw new Error("bank snapshot version mismatch");
  if (typeof snapshot.currency !== "string" || !Array.isArray(snapshot.accounts) || !Array.isArray(snapshot.transactions)) {
    throw new Error("bank snapshot shape is invalid");
  }
  const expectedHead = snapshot.transactions.at(-1)?.hash ?? null;
  if (snapshot.headHash !== expectedHead) throw new Error("bank snapshot head hash mismatch");
  if (!verifyJournalChain(snapshot.transactions)) throw new Error("bank snapshot journal integrity check failed");
}

export function restoreLedgerFromSnapshot(snapshot) {
  assertSnapshotShape(snapshot);

  const ledger = new HerculesBankLedger({currency:snapshot.currency});
  const seen = new Set();
  for (const account of snapshot.accounts) {
    if (!account || typeof account !== "object") throw new Error("bank snapshot account is invalid");
    if (seen.has(account.id)) throw new Error("bank snapshot contains duplicate accounts");
    seen.add(account.id);
    ledger.createAccount({
      id:account.id,
      currency:account.currency,
      normalSide:account.normalSide,
      allowNegative:account.allowNegative,
    });
  }

  for (const expected of snapshot.transactions) {
    const actual = ledger.post({
      idempotencyKey:expected.idempotencyKey,
      reference:expected.reference,
      entries:expected.entries,
    });
    if (actual.hash !== expected.hash || actual.previousHash !== expected.previousHash) {
      throw new Error("bank snapshot transaction hash mismatch during restore");
    }
  }

  const restored = ledger.snapshot();
  if (JSON.stringify(restored) !== JSON.stringify(snapshot)) {
    throw new Error("bank snapshot restore verification failed");
  }
  return ledger;
}

export class HerculesBankStateStore {
  #path;

  constructor({path}) {
    this.#path = resolve(nonEmpty(path, "path"));
  }

  get path() {
    return this.#path;
  }

  async save(snapshot) {
    assertSnapshotShape(snapshot);
    restoreLedgerFromSnapshot(snapshot);

    await mkdir(dirname(this.#path), {recursive:true});
    const tempPath = this.#path + ".tmp-" + process.pid + "-" + randomUUID();
    const bytes = JSON.stringify(snapshot, null, 2) + "\n";

    try {
      await writeFile(tempPath, bytes, {encoding:"utf8", mode:0o600, flag:"wx"});
      await rename(tempPath, this.#path);
    } catch (error) {
      await rm(tempPath, {force:true}).catch(() => {});
      throw error;
    }

    return clone(snapshot);
  }

  async load() {
    let raw;
    try {
      raw = await readFile(this.#path, "utf8");
    } catch (error) {
      throw new Error("unable to read bank state: " + error.message, {cause:error});
    }

    let snapshot;
    try {
      snapshot = JSON.parse(raw);
    } catch (error) {
      throw new Error("unable to parse bank state JSON", {cause:error});
    }

    restoreLedgerFromSnapshot(snapshot);
    return clone(snapshot);
  }
}
