import {HerculesBankLedger} from "./ledger.mjs";
import {restoreLedgerFromSnapshot} from "./store.mjs";

const SANDBOX_SNAPSHOT_SCHEMA = "sauceapproved.hercules.bank-sandbox-snapshot";
const SANDBOX_SNAPSHOT_VERSION = 1;
const SYSTEM_CASH_ACCOUNT_ID = "system:sandbox-cash";

function nonEmpty(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(label + " must be a non-empty string");
  }
  return value.trim();
}

function normalizeCurrency(value) {
  const currency = nonEmpty(value, "currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new TypeError("currency must be a three-letter code");
  return currency;
}

function clone(value) {
  return structuredClone(value);
}

function validateRestoredAccounts({ledger, accounts, currency}) {
  if (!Array.isArray(accounts)) throw new Error("bank sandbox snapshot accounts are invalid");
  const seen = new Set();
  for (const metadata of accounts) {
    if (!metadata || typeof metadata !== "object") {
      throw new Error("bank sandbox account metadata is invalid");
    }
    const id = nonEmpty(metadata.id, "account id");
    const customerId = nonEmpty(metadata.customerId, "customerId");
    if (seen.has(id)) throw new Error("bank sandbox snapshot contains duplicate accounts");
    seen.add(id);

    const ledgerAccount = ledger.account(id);
    if (!ledgerAccount) throw new Error("bank sandbox snapshot account is missing from ledger");
    if (
      ledgerAccount.currency !== currency
      || ledgerAccount.normalSide !== "CREDIT"
      || ledgerAccount.allowNegative !== false
    ) {
      throw new Error("bank sandbox account ledger metadata mismatch");
    }
    if (
      metadata.currency !== currency
      || metadata.status !== "OPEN"
      || metadata.mode !== "SANDBOX"
      || metadata.customerId !== customerId
    ) {
      throw new Error("bank sandbox account metadata mismatch");
    }
  }

  const system = ledger.account(SYSTEM_CASH_ACCOUNT_ID);
  if (
    !system
    || system.currency !== currency
    || system.normalSide !== "DEBIT"
    || system.allowNegative !== true
  ) {
    throw new Error("bank sandbox system cash account mismatch");
  }

  for (const ledgerAccount of ledger.snapshot().accounts) {
    if (ledgerAccount.id === SYSTEM_CASH_ACCOUNT_ID) continue;
    if (ledgerAccount.normalSide === "CREDIT" && !seen.has(ledgerAccount.id)) {
      throw new Error("bank sandbox snapshot contains orphan customer ledger account");
    }
  }
}

export class HerculesBankSandbox {
  #currency;
  #ledger;
  #accounts = new Map();
  #systemCashAccountId = SYSTEM_CASH_ACCOUNT_ID;

  constructor({currency = "USD", snapshot = null} = {}) {
    this.mode = "SANDBOX";

    if (snapshot !== null) {
      if (!snapshot || typeof snapshot !== "object") {
        throw new TypeError("bank sandbox snapshot must be an object");
      }
      if (snapshot.schema !== SANDBOX_SNAPSHOT_SCHEMA) {
        throw new Error("bank sandbox snapshot schema mismatch");
      }
      if (snapshot.version !== SANDBOX_SNAPSHOT_VERSION) {
        throw new Error("bank sandbox snapshot version mismatch");
      }
      if (snapshot.mode !== this.mode) throw new Error("bank sandbox snapshot mode mismatch");

      this.#currency = normalizeCurrency(snapshot.currency);
      this.#ledger = restoreLedgerFromSnapshot(snapshot.ledger);
      validateRestoredAccounts({
        ledger:this.#ledger,
        accounts:snapshot.accounts,
        currency:this.#currency,
      });

      for (const metadata of snapshot.accounts) {
        const account = Object.freeze({
          id:metadata.id,
          customerId:metadata.customerId,
          currency:metadata.currency,
          status:metadata.status,
          mode:metadata.mode,
        });
        this.#accounts.set(account.id, account);
      }
      return;
    }

    this.#currency = normalizeCurrency(currency);
    this.#ledger = new HerculesBankLedger({currency:this.#currency});
    this.#ledger.createAccount({
      id:this.#systemCashAccountId,
      currency:this.#currency,
      normalSide:"DEBIT",
      allowNegative:true,
    });
  }

  static fromSnapshot(snapshot) {
    return new HerculesBankSandbox({snapshot});
  }

  get currency() {
    return this.#currency;
  }

  openCustomerAccount({customerId, accountId}) {
    const normalizedCustomerId = nonEmpty(customerId, "customerId");
    const normalizedAccountId = nonEmpty(accountId, "accountId");
    this.#ledger.createAccount({
      id:normalizedAccountId,
      currency:this.#currency,
      normalSide:"CREDIT",
      allowNegative:false,
    });

    const metadata = Object.freeze({
      id:normalizedAccountId,
      customerId:normalizedCustomerId,
      currency:this.#currency,
      status:"OPEN",
      mode:this.mode,
    });
    this.#accounts.set(normalizedAccountId, metadata);
    return metadata;
  }

  listAccountsForCustomer(customerId) {
    const normalizedCustomerId = nonEmpty(customerId, "customerId");
    return [...this.#accounts.values()]
      .filter((account) => account.customerId === normalizedCustomerId)
      .map((account) => this.getAccount(account.id));
  }

  getAccount(accountId) {
    const id = nonEmpty(accountId, "accountId");
    const metadata = this.#accounts.get(id);
    if (!metadata) throw new Error("unknown customer account: " + id);
    return Object.freeze({
      ...metadata,
      balanceMinor:this.#ledger.balance(id),
    });
  }

  fundSandboxAccount({accountId, amountMinor, idempotencyKey}) {
    const account = this.getAccount(accountId);
    this.#ledger.post({
      idempotencyKey,
      reference:"sandbox funding",
      entries:[
        {accountId:this.#systemCashAccountId, side:"DEBIT", amountMinor},
        {accountId:account.id, side:"CREDIT", amountMinor},
      ],
    });
    return this.getAccount(account.id);
  }

  transfer({
    fromAccountId,
    toAccountId,
    amountMinor,
    idempotencyKey,
    reference = "sandbox internal transfer",
  }) {
    const from = this.getAccount(fromAccountId);
    const to = this.getAccount(toAccountId);
    this.#ledger.transferCustomerLiability({
      idempotencyKey,
      fromAccountId:from.id,
      toAccountId:to.id,
      amountMinor,
      reference,
    });
    return Object.freeze({
      from:this.getAccount(from.id),
      to:this.getAccount(to.id),
    });
  }

  reverseTransaction({
    transactionHash,
    idempotencyKey,
    reason = "sandbox transaction reversal",
  }) {
    const reversalOf = nonEmpty(transactionHash, "transactionHash");
    const reversal = this.#ledger.reverseTransaction({
      transactionHash:reversalOf,
      idempotencyKey,
      reason,
    });
    const accountIds = [...new Set(
      reversal.entries
        .map((entry) => entry.accountId)
        .filter((accountId) => this.#accounts.has(accountId)),
    )];
    return Object.freeze({
      transaction:Object.freeze({
        sequence:reversal.sequence,
        hash:reversal.hash,
        reference:reversal.reference,
        currency:reversal.currency,
        reversalOf,
        entries:Object.freeze(reversal.entries.map((entry) => Object.freeze({...entry}))),
      }),
      accounts:Object.freeze(accountIds.map((accountId) => this.getAccount(accountId))),
    });
  }

  statement(accountId) {
    const account = this.getAccount(accountId);
    const entries = [];

    for (const transaction of this.#ledger.transactions()) {
      for (const entry of transaction.entries) {
        if (entry.accountId !== account.id) continue;
        entries.push(Object.freeze({
          sequence:transaction.sequence,
          transactionHash:transaction.hash,
          reference:transaction.reference,
          currency:transaction.currency,
          side:entry.side,
          amountMinor:entry.amountMinor,
        }));
      }
    }

    return Object.freeze({
      accountId:account.id,
      customerId:account.customerId,
      currency:account.currency,
      balanceMinor:account.balanceMinor,
      entries:Object.freeze(entries),
      mode:this.mode,
    });
  }

  journal() {
    return this.#ledger.transactions();
  }

  snapshot() {
    return {
      schema:SANDBOX_SNAPSHOT_SCHEMA,
      version:SANDBOX_SNAPSHOT_VERSION,
      mode:this.mode,
      currency:this.#currency,
      accounts:[...this.#accounts.values()].map((account) => clone(account)),
      ledger:this.#ledger.snapshot(),
    };
  }

  requestExternalTransfer() {
    throw new Error("external payment rails are disabled in Hercules Bank sandbox mode");
  }
}
