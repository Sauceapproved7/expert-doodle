const SPACESHIP_API_BASE = "https://spaceship.dev/api/v1";
const DEFAULT_ALLOWED_DOMAINS = Object.freeze(["sauceapproved.com"]);
const SUPPORTED_MANAGED_TYPES = new Set(["A", "AAAA", "CNAME"]);

export const SHOPIFY_DNS_RECORDS = Object.freeze([
  Object.freeze({type:"A", name:"@", address:"23.227.38.65", ttl:3600}),
  Object.freeze({type:"AAAA", name:"@", address:"2620:0127:f00f:5::", ttl:3600}),
  Object.freeze({type:"CNAME", name:"www", cname:"shops.myshopify.com", ttl:3600}),
]);

const MANAGED_KEYS = new Set(SHOPIFY_DNS_RECORDS.map((record) => recordKey(record)));

function required(value, name) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(name + " is required");
  return text;
}

function assertDomain(domain) {
  const value = required(domain, "domain").toLowerCase().replace(/\.$/, "");
  if (!/^(?=.{4,255}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) {
    throw new TypeError("valid domain required");
  }
  return value;
}

function recordKey(record) {
  return String(record?.type || "").trim().toUpperCase() + ":" + String(record?.name || "").trim().toLowerCase();
}

function recordGroupType(record) {
  const raw = record?.group;
  if (raw && typeof raw === "object") return String(raw.type || "").trim();
  if (typeof raw === "string") return raw.trim();
  return "unknown";
}

function cleanManagedRecord(record, {includeTtl = true} = {}) {
  if (!record || typeof record !== "object") throw new TypeError("DNS record object required");
  const type = String(record.type || "").trim().toUpperCase();
  const name = String(record.name || "").trim();
  if (!SUPPORTED_MANAGED_TYPES.has(type) || !name) throw new TypeError("supported DNS record type and name required");

  const out = {type, name};
  if (type === "CNAME") {
    const cname = String(record.cname || "").trim().replace(/\.$/, "");
    if (!cname) throw new TypeError("CNAME canonical name required");
    out.cname = cname;
  } else {
    const address = String(record.address || "").trim();
    if (!address) throw new TypeError(type + " address required");
    out.address = address;
  }

  if (includeTtl && record.ttl != null) {
    const ttl = Number(record.ttl);
    if (!Number.isInteger(ttl) || ttl < 60 || ttl > 3600) throw new TypeError("DNS TTL out of range");
    out.ttl = ttl;
  }
  return out;
}

function normalizedValue(record) {
  const clean = cleanManagedRecord(record, {includeTtl:false});
  return clean.type === "CNAME"
    ? clean.cname.toLowerCase()
    : clean.address.toLowerCase();
}

function sameManagedRecord(a, b) {
  return recordKey(a) === recordKey(b) && normalizedValue(a) === normalizedValue(b);
}

export function planShopifyDnsReconciliation(existingRecords = []) {
  if (!Array.isArray(existingRecords)) throw new TypeError("existingRecords must be an array");

  const desired = SHOPIFY_DNS_RECORDS.map((record) => ({...record}));
  const desiredByKey = new Map(desired.map((record) => [recordKey(record), record]));
  const deleteRecords = [];
  const blockingConflicts = [];
  const unchanged = [];

  for (const raw of existingRecords) {
    const key = recordKey(raw);
    const target = desiredByKey.get(key);
    if (!target) {
      unchanged.push(raw);
      continue;
    }

    const record = cleanManagedRecord(raw);
    if (sameManagedRecord(record, target)) continue;

    const group = recordGroupType(raw);
    if (group === "custom") {
      deleteRecords.push(cleanManagedRecord(record, {includeTtl:false}));
    } else {
      blockingConflicts.push({
        key,
        group,
        record:cleanManagedRecord(record, {includeTtl:false}),
      });
    }
  }

  const saveRecords = desired.filter((target) =>
    !existingRecords.some((record) => recordKey(record) === recordKey(target) && sameManagedRecord(record, target))
  );

  return {
    desired,
    deleteRecords,
    saveRecords,
    blockingConflicts,
    unchanged,
    safeToApply:blockingConflicts.length === 0,
    ready:blockingConflicts.length === 0 && deleteRecords.length === 0 && saveRecords.length === 0,
  };
}

export class SpaceshipDnsClient {
  constructor({
    apiKey,
    apiSecret,
    allowedDomains = DEFAULT_ALLOWED_DOMAINS,
    fetchImpl = globalThis.fetch,
    baseUrl = SPACESHIP_API_BASE,
  } = {}) {
    this.apiKey = required(apiKey, "Spaceship API key");
    this.apiSecret = required(apiSecret, "Spaceship API secret");
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation required");
    this.fetch = fetchImpl;
    this.baseUrl = required(baseUrl, "Spaceship API base").replace(/\/$/, "");
    this.allowedDomains = new Set((allowedDomains || []).map(assertDomain));
    if (this.allowedDomains.size === 0) throw new Error("at least one allowed domain is required");
  }

  assertAllowed(domain) {
    const value = assertDomain(domain);
    if (!this.allowedDomains.has(value)) throw new Error("domain is not allowlisted");
    return value;
  }

  headers(extra = {}) {
    return {
      "X-API-Key":this.apiKey,
      "X-API-Secret":this.apiSecret,
      ...extra,
    };
  }

  async request(path, init = {}) {
    const response = await this.fetch(this.baseUrl + path, {
      ...init,
      headers:this.headers(init.headers || {}),
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); }
      catch { payload = {detail:text.slice(0, 1000)}; }
    }
    if (!response.ok) {
      const detail = String(payload?.detail || payload?.message || "Spaceship API request failed").slice(0, 500);
      const error = new Error("Spaceship DNS request failed: " + response.status + ": " + detail);
      error.status = response.status;
      throw error;
    }
    return {status:response.status, payload};
  }

  async listRecords(domain) {
    const name = this.assertAllowed(domain);
    const pageSize = 500;
    const maxRecords = 10000;
    const items = [];

    for (let skip = 0; skip < maxRecords; skip += pageSize) {
      const params = new URLSearchParams({take:String(pageSize), skip:String(skip), orderBy:"type"});
      const {payload} = await this.request(`/dns/records/${encodeURIComponent(name)}?${params}`);
      const page = Array.isArray(payload?.items) ? payload.items : [];
      const total = Number(payload?.total);
      if (!Number.isFinite(total) || total < 0) throw new Error("Spaceship DNS list total is invalid");

      items.push(...page);
      if (items.length > maxRecords) throw new Error("Spaceship DNS record limit exceeded");
      if (items.length >= total) return {items, total};
      if (page.length === 0) throw new Error("Spaceship DNS pagination ended before total");
    }

    throw new Error("Spaceship DNS record limit exceeded");
  }

  async saveRecords(domain, records, {force = false} = {}) {
    const name = this.assertAllowed(domain);
    if (!Array.isArray(records) || records.length < 1 || records.length > 500) {
      throw new TypeError("1 to 500 DNS records required");
    }
    const items = records.map((record) => cleanManagedRecord(record));
    await this.request(`/dns/records/${encodeURIComponent(name)}`, {
      method:"PUT",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({force:Boolean(force), items}),
    });
    return {saved:items.length};
  }

  async deleteRecords(domain, records) {
    const name = this.assertAllowed(domain);
    if (!Array.isArray(records) || records.length < 1 || records.length > 500) {
      throw new TypeError("1 to 500 DNS records required");
    }
    const items = records.map((record) => cleanManagedRecord(record, {includeTtl:false}));
    await this.request(`/dns/records/${encodeURIComponent(name)}`, {
      method:"DELETE",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(items),
    });
    return {deleted:items.length};
  }

  async reconcileShopify(domain, {replaceCustomConflicts = false} = {}) {
    const name = this.assertAllowed(domain);
    const before = await this.listRecords(name);
    const plan = planShopifyDnsReconciliation(before.items);

    if (plan.blockingConflicts.length) {
      const error = new Error("Shopify DNS blocked by provider-managed or unknown conflicting records");
      error.conflicts = plan.blockingConflicts;
      throw error;
    }

    if (plan.deleteRecords.length && !replaceCustomConflicts) {
      return {
        domain:name,
        status:"conflict",
        changed:false,
        plan,
      };
    }

    if (plan.deleteRecords.length) await this.deleteRecords(name, plan.deleteRecords);
    if (plan.saveRecords.length) await this.saveRecords(name, plan.saveRecords, {force:false});

    const after = await this.listRecords(name);
    const verification = planShopifyDnsReconciliation(after.items);
    if (!verification.ready) {
      const error = new Error("Shopify DNS reconciliation did not verify");
      error.plan = verification;
      throw error;
    }

    return {
      domain:name,
      status:"ready",
      changed:Boolean(plan.deleteRecords.length || plan.saveRecords.length),
      deleted:plan.deleteRecords,
      saved:plan.saveRecords,
      verified:true,
      records:desiredRecordsForOutput(),
    };
  }
}

function desiredRecordsForOutput() {
  return SHOPIFY_DNS_RECORDS.map((record) => ({...record}));
}

export function createSpaceshipDnsClientFromEnv(env = process.env, options = {}) {
  const apiKey = String(env.HERCULES_SPACESHIP_API_KEY || "").trim();
  const apiSecret = String(env.HERCULES_SPACESHIP_API_SECRET || "").trim();
  if (!apiKey || !apiSecret) return null;
  const allowedDomains = String(env.HERCULES_SPACESHIP_ALLOWED_DOMAINS || "sauceapproved.com")
    .split(",").map((value) => value.trim()).filter(Boolean);
  return new SpaceshipDnsClient({apiKey, apiSecret, allowedDomains, ...options});
}
