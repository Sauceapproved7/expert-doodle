import {randomUUID} from "node:crypto";
import {mkdir, readFile, rename, rm, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";

import {HerculesBankSandbox} from "./service.mjs";

function nonEmpty(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(label + " must be a non-empty string");
  }
  return value.trim();
}

function clone(value) {
  return structuredClone(value);
}

export class HerculesBankSandboxStore {
  #path;

  constructor({path}) {
    this.#path = resolve(nonEmpty(path, "statePath"));
  }

  get path() {
    return this.#path;
  }

  async save(snapshot) {
    const verified = HerculesBankSandbox.fromSnapshot(snapshot).snapshot();
    await mkdir(dirname(this.#path), {recursive:true});
    const tempPath = this.#path + ".tmp-" + process.pid + "-" + randomUUID();
    try {
      await writeFile(tempPath, JSON.stringify(verified, null, 2) + "\n", {
        encoding:"utf8",
        mode:0o600,
        flag:"wx",
      });
      await rename(tempPath, this.#path);
    } catch (error) {
      await rm(tempPath, {force:true}).catch(() => {});
      throw error;
    }
    return clone(verified);
  }

  async load() {
    let raw;
    try {
      raw = await readFile(this.#path, "utf8");
    } catch (error) {
      throw error;
    }

    let snapshot;
    try {
      snapshot = JSON.parse(raw);
    } catch (error) {
      throw new Error("unable to parse Hercules Bank sandbox state JSON", {cause:error});
    }
    return HerculesBankSandbox.fromSnapshot(snapshot).snapshot();
  }
}

export class HerculesBankRuntime {
  #bank;
  #store;
  #tail = Promise.resolve();

  constructor({bank, store}) {
    if (!(bank instanceof HerculesBankSandbox)) throw new TypeError("bank is required");
    if (!store || typeof store.save !== "function" || typeof store.load !== "function") {
      throw new TypeError("durable bank store is required");
    }
    this.#bank = bank;
    this.#store = store;
  }

  static async open({statePath, currency = "USD"} = {}) {
    const store = new HerculesBankSandboxStore({path:statePath});
    let bank;
    try {
      const snapshot = await store.load();
      bank = HerculesBankSandbox.fromSnapshot(snapshot);
      if (bank.currency !== String(currency).toUpperCase()) {
        throw new Error("existing Hercules Bank state currency mismatch");
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      bank = new HerculesBankSandbox({currency});
      await store.save(bank.snapshot());
    }
    return new HerculesBankRuntime({bank, store});
  }

  get mode() {
    return this.#bank.mode;
  }

  get currency() {
    return this.#bank.currency;
  }

  getAccount(accountId) {
    return this.#bank.getAccount(accountId);
  }

  listAccountsForCustomer(customerId) {
    return this.#bank.listAccountsForCustomer(customerId);
  }

  statement(accountId) {
    return this.#bank.statement(accountId);
  }

  journal() {
    return this.#bank.journal();
  }

  snapshot() {
    return this.#bank.snapshot();
  }

  async openCustomerAccount({customerId, accountId = "acct_" + randomUUID()} = {}) {
    return this.#commit((candidate) => {
      const opened = candidate.openCustomerAccount({customerId, accountId});
      return candidate.getAccount(opened.id);
    });
  }

  async fundSandboxAccount(input) {
    return this.#commit((candidate) => candidate.fundSandboxAccount(input));
  }

  async transfer(input) {
    return this.#commit((candidate) => candidate.transfer(input));
  }

  async reverseTransaction(input) {
    return this.#commit((candidate) => candidate.reverseTransaction(input));
  }

  requestExternalTransfer() {
    return this.#bank.requestExternalTransfer();
  }

  #commit(mutator) {
    const operation = this.#tail.then(async () => {
      const candidate = HerculesBankSandbox.fromSnapshot(this.#bank.snapshot());
      const result = await mutator(candidate);
      await this.#store.save(candidate.snapshot());
      this.#bank = candidate;
      return clone(result);
    });
    this.#tail = operation.catch(() => {});
    return operation;
  }
}
