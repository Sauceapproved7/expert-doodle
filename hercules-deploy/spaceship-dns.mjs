const API_BASE = "https://spaceship.dev/api/v1";
const DEFAULT_ALLOWED_DOMAINS = Object.freeze(["sauceapproved.com"]);
const SUPPORTED_TYPES = new Set(["A", "AAAA", "CNAME"]);

export const SHOPIFY_DNS_RECORDS = Object.freeze([
  Object.freeze({type:"A", name:"@", address:"23.227.38.65", ttl:3600}),
  Object.freeze({type:"AAAA", name:"@", address:"2620:0127:f00f:5::", ttl:3600}),
  Object.freeze({type:"CNAME", name:"www", cname:"shops.myshopify.com", ttl:3600}),
]);

function required(value, name) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(name + " is required");
  return text;
}

function domainName(value) {
  const domain = required(value, "domain").toLowerCase().replace(/\.$/, "");
  if (!/^(?=.{4,255}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new Error("invalid domain");
  }
  return domain;
}

function recordKey(record) {
  return String(record.type || "").toUpperCase() + ":" + String(record.name || "").toLowerCase();
}

function recordValue(record) {
  const type = String(record.type || "").toUpperCase();
  if (type === "A" || type === "AAAA") return String(record.address || "").toLowerCase();
  if (type === "CNAME") return String(record.cname || "").toLowerCase().replace(/\.$/, "");
  return "";
}

function withoutProviderMetadata(record) {
  const type = String(record.type || "").toUpperCase();
  const name = String(record.name || "");
  if (type === "A" || type === "AAAA") return {type, name, address:String(record.address || "")};
  if (type === "CNAME") return {type, name, cname:String(record.cname || "").replace(/\.$/, "")};
  throw new Error("unsupported record type");
}

function validateShopifyRecord(record) {
  const type = String(record?.type || "").toUpperCase();
  if (!SUPPORTED_TYPES.has(type)) throw new Error("unsupported DNS record type");
  const name = String(record?.name || "");
  if (!name) throw new Error("DNS record name required");
  if ((type === "A" || type === "AAAA") && !String(record?.address || "")) throw new Error("DNS address required");
  if (type === "CNAME" && !String(record?.cname || "")) throw new Error("DNS cname required");
  return record;
}

export function buildShopifyDnsPlan(existingRecords = []) {
  if (!Array.isArray(existingRecords)) throw new TypeError("existingRecords must be an array");

  const desiredByKey = new Map(SHOPIFY_DNS_RECORDS.map((record) => [recordKey(record), record]));
  const existingByKey = new Map();
  for (const record of existingRecords) {
    const key = recordKey(record);
    if (!desiredByKey.has(key)) continue;
    if (!existingByKey.has(key)) existingByKey.set(key, []);
    existingByKey.get(key).push(record);
  }

  const missing = [];
  const conflicts = [];
  for (const [key, desired] of desiredByKey) {
    const candidates = existingByKey.get(key) || [];
    const desiredValue = recordValue(desired);
    const matching = candidates.some((record) => recordValue(record) === desiredValue);
    if (!matching) missing.push({...desired});
    for (const record of candidates) {
      if (recordValue(record) === desiredValue) continue;
      conflicts.push({
        key,
        group: record.group ?? "custom",
        record: withoutProviderMetadata(record),
      });
    }
  }

  const blockingConflicts = conflicts.filter((item) => item.group !== "custom");
  const customConflicts = conflicts.filter((item) => item.group === "custom");

  return Object.freeze({
    desired: SHOPIFY_DNS_RECORDS.map((record) => ({...record})),
    missing,
    conflicts,
    customConflicts,
    blockingConflicts,
    safeToApply: blockingConflicts.length === 0,
  });
}

export class SpaceshipDnsClient {
  constructor({
    apiKey,
    apiSecret,
    allowedDomains = DEFAULT_ALLOWED_DOMAINS,
    fetchImpl = globalThis.fetch,
    apiBase = API_BASE,
  } = {}) {
    this.apiKey = required(apiKey, "Spaceship API key");
    this.apiSecret = required(apiSecret, "Spaceship API secret");
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation required");
    this.fetchImpl = fetchImpl;
    this.apiBase = required(apiBase, "Spaceship API base").replace(/\/$/, "");
    this.allowedDomains = new Set((allowedDomains || []).map(domainName));
    if (this.allowedDomains.size === 0) throw new Error("at least one allowed domain is required");
  }

  assertAllowed(domain) {
    const normalized = domainName(domain);
    if (!this.allowedDomains.has(normalized)) throw new Error("domain is not allowlisted");
    return normalized;
  }

  async request(path, {method="GET", body} = {}) {
    const response = await this.fetchImpl(this.apiBase + path, {
      method,
      headers: {
        "accept":"application/json",
        "content-type":"application/json",
        "X-API-Key":this.apiKey,
        "X-API-Secret":this.apiSecret,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); }
      catch { payload = {detail:text.slice(0, 1000)}; }
    }
    if (!response.ok) {
      const detail = String(payload?.detail || payload?.message || "Spaceship API request failed").slice(0, 500);
      throw new Error("Spaceship API " + response.status + ": " + detail);
    }
    return payload;
  }

  async listRecords(domain) {
    const normalized = this.assertAllowed(domain);
    const query = new URLSearchParams({take:"500", skip:"0", orderBy:"type"});
    const payload = await this.request("/dns/records/" + encodeURIComponent(normalized) + "?" + query);
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  async saveRecords(domain, records, {force=false} = {}) {
    const normalized = this.assertAllowed(domain);
    if (!Array.isArray(records) || records.length === 0) return {saved:0};
    records.forEach(validateShopifyRecord);
    await this.request("/dns/records/" + encodeURIComponent(normalized), {
      method:"PUT",
      body:{force:Boolean(force), items:records},
    });
    return {saved:records.length};
  }

  async deleteRecords(domain, records) {
    const normalized = this.assertAllowed(domain);
    if (!Array.isArray(records) || records.length === 0) return {deleted:0};
    const body = records.map(withoutProviderMetadata);
    await this.request("/dns/records/" + encodeURIComponent(normalized), {
      method:"DELETE",
      body,
    });
    return {deleted:body.length};
  }

  async reconcileShopify(domain, {replaceCustomConflicts=false} = {}) {
    const normalized = this.assertAllowed(domain);
    const before = await this.listRecords(normalized);
    const plan = buildShopifyDnsPlan(before);

    if (plan.blockingConflicts.length) {
      throw new Error("Shopify DNS blocked by provider-managed conflicting records");
    }
    if (plan.customConflicts.length && !replaceCustomConflicts) {
      return {status:"conflict", changed:false, plan};
    }

    if (plan.customConflicts.length) {
      await this.deleteRecords(normalized, plan.customConflicts.map((item) => item.record));
    }

    if (plan.missing.length) {
      await this.saveRecords(normalized, plan.missing, {force:false});
    }

    const after = await this.listRecords(normalized);
    const verification = buildShopifyDnsPlan(after);
    if (verification.missing.length || verification.conflicts.length) {
      throw new Error("Shopify DNS verification failed after update");
    }

    return {
      status:"ready",
      changed:Boolean(plan.customConflicts.length || plan.missing.length),
      beforePlan:plan,
      verification,
    };
  }
}

export function createSauceApprovedSpaceshipDnsClientFromEnv(
  env = process.env,
  {fetchImpl = globalThis.fetch} = {},
) {
  const allowed = String(env.HERCULES_SPACESHIP_ALLOWED_DOMAINS || "sauceapproved.com")
    .split(",").map((value) => value.trim()).filter(Boolean);
  return new SpaceshipDnsClient({
    apiKey:env.HERCULES_SPACESHIP_API_KEY,
    apiSecret:env.HERCULES_SPACESHIP_API_SECRET,
    allowedDomains:allowed,
    fetchImpl,
  });
}
