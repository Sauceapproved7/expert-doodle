import {HerculesBankLedger} from "./ledger.mjs";

function nonEmpty(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(label + " must be a non-empty string");
  }
  return value.trim();
}

export class HerculesBankSandbox {
  #currency;
  #ledger;
  #accounts = new Map();
  #systemCashAccountId = "system:sandbox-cash";

  constructor({currency = "USD"} = {}) {
    this.mode = "SANDBOX";
    this.#currency = nonEmpty(currency, "currency").toUpperCase();
    this.#ledger = new HerculesBankLedger({currency:this.#currency});
    this.#ledger.createAccount({
      id:this.#systemCashAccountId,
      currency:this.#currency,
      normalSide:"DEBIT",
      allowNegative:true,
    });
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

  requestExternalTransfer() {
    throw new Error("external payment rails are disabled in Hercules Bank sandbox mode");
  }
}
