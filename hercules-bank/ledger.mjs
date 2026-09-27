import {createHash} from "node:crypto";

const SIDES = new Set(["DEBIT", "CREDIT"]);
const REVERSAL_MARKER = "[reversal-of:";

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(label + " must be a non-empty string");
  }
  return value.trim();
}

function assertSide(value, label = "side") {
  if (!SIDES.has(value)) throw new TypeError(label + " must be DEBIT or CREDIT");
  return value;
}

function assertAmountMinor(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError("amountMinor must be a positive safe integer");
  }
  return value;
}

function normalizeCurrency(value) {
  const currency = assertNonEmptyString(value, "currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new TypeError("currency must be a three-letter code");
  return currency;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function economicFingerprint(input) {
  return sha256(stableJson({
    reference: input.reference,
    entries: input.entries.map((entry) => ({
      accountId: entry.accountId,
      side: entry.side,
      amountMinor: entry.amountMinor,
    })),
  }));
}

function transactionHash(transaction) {
  const unsigned = {
    sequence: transaction.sequence,
    idempotencyKey: transaction.idempotencyKey,
    reference: transaction.reference,
    currency: transaction.currency,
    entries: transaction.entries,
    previousHash: transaction.previousHash,
    economicFingerprint: transaction.economicFingerprint,
  };
  return sha256(stableJson(unsigned));
}

export function verifyJournalChain(transactions) {
  if (!Array.isArray(transactions)) return false;
  let previousHash = null;
  for (let index = 0; index < transactions.length; index += 1) {
    const transaction = transactions[index];
    if (!transaction || transaction.sequence !== index + 1) return false;
    if (transaction.previousHash !== previousHash) return false;
    if (transaction.hash !== transactionHash(transaction)) return false;
    previousHash = transaction.hash;
  }
  return true;
}

export class HerculesBankLedger {
  #currency;
  #accounts = new Map();
  #transactions = [];
  #idempotency = new Map();

  constructor({currency = "USD"} = {}) {
    this.#currency = normalizeCurrency(currency);
  }

  createAccount({
    id,
    currency = this.#currency,
    normalSide,
    allowNegative = false,
  }) {
    const accountId = assertNonEmptyString(id, "account id");
    if (this.#accounts.has(accountId)) throw new Error("account already exists: " + accountId);

    const account = Object.freeze({
      id: accountId,
      currency: normalizeCurrency(currency),
      normalSide: assertSide(normalSide, "normalSide"),
      allowNegative: Boolean(allowNegative),
    });

    this.#accounts.set(accountId, account);
    return account;
  }

  account(id) {
    return this.#accounts.get(id) ?? null;
  }

  balance(accountId) {
    const account = this.#requireAccount(accountId);
    let balance = 0;
    for (const transaction of this.#transactions) {
      for (const entry of transaction.entries) {
        if (entry.accountId !== account.id) continue;
        const increases = entry.side === account.normalSide;
        balance += increases ? entry.amountMinor : -entry.amountMinor;
      }
    }
    return balance;
  }

  transactions() {
    return this.#transactions.slice();
  }

  snapshot() {
    const transactions = this.#transactions.map((transaction) => ({
      ...transaction,
      entries: transaction.entries.map((entry) => ({...entry})),
    }));
    return {
      schema:"sauceapproved.hercules.bank-ledger-snapshot",
      version:1,
      currency:this.#currency,
      accounts:[...this.#accounts.values()].map((account) => ({...account})),
      transactions,
      headHash:transactions.at(-1)?.hash ?? null,
    };
  }

  post({idempotencyKey, reference, entries}) {
    const key = assertNonEmptyString(idempotencyKey, "idempotencyKey");
    const normalizedReference = assertNonEmptyString(reference, "reference");
    if (!Array.isArray(entries) || entries.length < 2) {
      throw new TypeError("entries must contain at least two journal entries");
    }

    const normalizedEntries = entries.map((entry) => {
      if (!entry || typeof entry !== "object") throw new TypeError("journal entry must be an object");
      const account = this.#requireAccount(entry.accountId);
      return Object.freeze({
        accountId: account.id,
        side: assertSide(entry.side),
        amountMinor: assertAmountMinor(entry.amountMinor),
      });
    });

    const currencies = new Set(
      normalizedEntries.map((entry) => this.#requireAccount(entry.accountId).currency),
    );
    if (currencies.size !== 1) throw new Error("journal entries must use one currency");
    const [currency] = currencies;

    let debits = 0;
    let credits = 0;
    for (const entry of normalizedEntries) {
      if (entry.side === "DEBIT") debits += entry.amountMinor;
      else credits += entry.amountMinor;
      if (!Number.isSafeInteger(debits) || !Number.isSafeInteger(credits)) {
        throw new RangeError("journal amount exceeds safe integer range");
      }
    }
    if (debits !== credits) throw new Error("journal must be balanced: debits must equal credits");

    const normalized = {
      reference: normalizedReference,
      entries: normalizedEntries,
    };
    const fingerprint = economicFingerprint(normalized);
    const existing = this.#idempotency.get(key);
    if (existing) {
      if (existing.economicFingerprint !== fingerprint) {
        throw new Error("idempotency key was already used for different economics");
      }
      return existing;
    }

    const projected = new Map();
    for (const entry of normalizedEntries) {
      const account = this.#requireAccount(entry.accountId);
      const current = projected.has(account.id) ? projected.get(account.id) : this.balance(account.id);
      const delta = entry.side === account.normalSide ? entry.amountMinor : -entry.amountMinor;
      const next = current + delta;
      if (!Number.isSafeInteger(next)) throw new RangeError("account balance exceeds safe integer range");
      projected.set(account.id, next);
    }

    for (const [accountId, next] of projected) {
      const account = this.#requireAccount(accountId);
      if (!account.allowNegative && next < 0) {
        throw new Error("account would become negative; insufficient funds or overdraft");
      }
    }

    const previousHash = this.#transactions.at(-1)?.hash ?? null;
    const transaction = {
      sequence: this.#transactions.length + 1,
      idempotencyKey: key,
      reference: normalizedReference,
      currency,
      entries: normalizedEntries,
      previousHash,
      economicFingerprint: fingerprint,
    };
    transaction.hash = transactionHash(transaction);
    Object.freeze(transaction.entries);
    Object.freeze(transaction);

    this.#transactions.push(transaction);
    this.#idempotency.set(key, transaction);
    return transaction;
  }

  transferCustomerLiability({
    idempotencyKey,
    fromAccountId,
    toAccountId,
    amountMinor,
    reference = "internal customer transfer",
  }) {
    if (fromAccountId === toAccountId) throw new Error("transfer accounts must be different");
    assertAmountMinor(amountMinor);

    const from = this.#requireAccount(fromAccountId);
    const to = this.#requireAccount(toAccountId);
    if (from.normalSide !== "CREDIT" || to.normalSide !== "CREDIT") {
      throw new Error("customer liability transfer requires CREDIT-normal accounts");
    }
    if (from.currency !== to.currency) throw new Error("transfer accounts must use the same currency");

    return this.post({
      idempotencyKey,
      reference,
      entries:[
        {accountId:from.id, side:"DEBIT", amountMinor},
        {accountId:to.id, side:"CREDIT", amountMinor},
      ],
    });
  }

  reverseTransaction({
    transactionHash,
    idempotencyKey,
    reason = "sandbox transaction reversal",
  }) {
    const hash = assertNonEmptyString(transactionHash, "transactionHash");
    const key = assertNonEmptyString(idempotencyKey, "idempotencyKey");
    const normalizedReason = assertNonEmptyString(reason, "reason");
    const original = this.#transactions.find((transaction) => transaction.hash === hash);
    if (!original) throw new Error("unknown transaction: " + hash);
    if (original.reference.includes(REVERSAL_MARKER)) {
      throw new Error("reversal transactions cannot be reversed");
    }

    const marker = REVERSAL_MARKER + hash + "]";
    const entries = original.entries.map((entry) => ({
      accountId:entry.accountId,
      side:entry.side === "DEBIT" ? "CREDIT" : "DEBIT",
      amountMinor:entry.amountMinor,
    }));
    const reference = normalizedReason + " " + marker;
    const existing = this.#transactions.find((transaction) => transaction.reference.endsWith(marker));
    if (existing && existing.idempotencyKey !== key) {
      throw new Error("transaction was already reversed");
    }

    return this.post({
      idempotencyKey:key,
      reference,
      entries,
    });
  }

  #requireAccount(accountId) {
    const id = assertNonEmptyString(accountId, "account id");
    const account = this.#accounts.get(id);
    if (!account) throw new Error("unknown account: " + id);
    return account;
  }
}
