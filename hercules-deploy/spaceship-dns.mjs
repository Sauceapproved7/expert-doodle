const SPACESHIP_API_BASE = "https://spaceship.dev/api/v1";

export const SHOPIFY_DNS_RECORDS = Object.freeze([
  Object.freeze({type:"A", name:"@", address:"23.227.38.65", ttl:3600}),
  Object.freeze({type:"AAAA", name:"@", address:"2620:0127:f00f:5::", ttl:3600}),
  Object.freeze({type:"CNAME", name:"www", address:"shops.myshopify.com", ttl:3600}),
]);

const MANAGED_KEYS = new Set(SHOPIFY_DNS_RECORDS.map((record) => `${record.type}:${record.name}`));

function assertDomain(domain) {
  const value = String(domain || "").trim().toLowerCase();
  if (!/^(?=.{4,255}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) {
    throw new TypeError("valid domain required");
  }
  return value;
}

function cleanRecord(record, {includeTtl = true} = {}) {
  if (!record || typeof record !== "object") throw new TypeError("DNS record object required");
  const type = String(record.type || "").trim().toUpperCase();
  const name = String(record.name || "").trim();
  const address = String(record.address || "").trim();
  if (!type || !name || !address) throw new TypeError("DNS record type, name and address required");
  const out = {type, name, address};
  if (includeTtl && record.ttl != null) {
    const ttl = Number(record.ttl);
    if (!Number.isInteger(ttl) || ttl < 60 || ttl > 86400) throw new TypeError("DNS TTL out of range");
    out.ttl = ttl;
  }
  return out;
}

function sameRecord(a, b) {
  return a.type === b.type &&
    a.name.toLowerCase() === b.name.toLowerCase() &&
    a.address.replace(/\.$/, "").toLowerCase() === b.address.replace(/\.$/, "").toLowerCase();
}

export function planShopifyDnsReconciliation(existingRecords = []) {
  const existing = existingRecords.map((record) => cleanRecord(record));
  const desired = SHOPIFY_DNS_RECORDS.map((record) => ({...record}));
  const deleteRecords = [];
  const saveRecords = [];

  for (const record of existing) {
    const key = `${record.type}:${record.name}`;
    if (!MANAGED_KEYS.has(key)) continue;
    if (!desired.some((target) => sameRecord(record, target))) {
      deleteRecords.push(cleanRecord(record, {includeTtl:false}));
    }
  }

  for (const target of desired) {
    if (!existing.some((record) => sameRecord(record, target))) saveRecords.push({...target});
  }

  return {
    desired,
    deleteRecords,
    saveRecords,
    unchanged: existing.filter((record) => !MANAGED_KEYS.has(`${record.type}:${record.name}`)),
    ready: deleteRecords.length === 0 && saveRecords.length === 0,
  };
}

export class SpaceshipDnsClient {
  constructor({apiKey, apiSecret, fetchImpl = globalThis.fetch, baseUrl = SPACESHIP_API_BASE} = {}) {
    if (!apiKey || !apiSecret) throw new Error("Spaceship API key and secret required");
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation required");
    this.apiKey = String(apiKey);
    this.apiSecret = String(apiSecret);
    this.fetch = fetchImpl;
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
  }

  headers(extra = {}) {
    return {
      "X-API-Key": this.apiKey,
      "X-API-Secret": this.apiSecret,
      ...extra,
    };
  }

  async request(path, init = {}) {
    const response = await this.fetch(this.baseUrl + path, {
      ...init,
      headers: this.headers(init.headers || {}),
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); }
      catch { payload = {raw:text.slice(0, 4000)}; }
    }
    if (!response.ok) {
      const error = new Error(`Spaceship DNS request failed: ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return {status:response.status, payload};
  }

  async listRecords(domain, {take = 500, skip = 0, orderBy = "type"} = {}) {
    const name = assertDomain(domain);
    const params = new URLSearchParams({
      take:String(Math.max(1, Math.min(500, Number(take) || 500))),
      skip:String(Math.max(0, Number(skip) || 0)),
      orderBy:String(orderBy || "type"),
    });
    const {payload} = await this.request(`/dns/records/${encodeURIComponent(name)}?${params}`);
    return {
      items:Array.isArray(payload?.items) ? payload.items : [],
      total:Number(payload?.total || 0),
    };
  }

  async saveRecords(domain, records, {force = false} = {}) {
    const name = assertDomain(domain);
    if (!Array.isArray(records) || records.length < 1 || records.length > 500) {
      throw new TypeError("1 to 500 DNS records required");
    }
    const items = records.map((record) => cleanRecord(record));
    await this.request(`/dns/records/${encodeURIComponent(name)}`, {
      method:"PUT",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({force:Boolean(force), items}),
    });
    return {saved:items.length};
  }

  async deleteRecords(domain, records) {
    const name = assertDomain(domain);
    if (!Array.isArray(records) || records.length < 1 || records.length > 500) {
      throw new TypeError("1 to 500 DNS records required");
    }
    const items = records.map((record) => cleanRecord(record, {includeTtl:false}));
    await this.request(`/dns/records/${encodeURIComponent(name)}`, {
      method:"DELETE",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(items),
    });
    return {deleted:items.length};
  }

  async reconcileShopify(domain, {force = false} = {}) {
    const before = await this.listRecords(domain);
    const plan = planShopifyDnsReconciliation(before.items);

    if (plan.deleteRecords.length) await this.deleteRecords(domain, plan.deleteRecords);
    if (plan.saveRecords.length) await this.saveRecords(domain, plan.saveRecords, {force});

    const after = await this.listRecords(domain);
    const verification = planShopifyDnsReconciliation(after.items);
    if (!verification.ready) {
      const error = new Error("Shopify DNS reconciliation did not verify");
      error.plan = verification;
      throw error;
    }

    return {
      domain:assertDomain(domain),
      changed:plan.deleteRecords.length + plan.saveRecords.length,
      deleted:plan.deleteRecords,
      saved:plan.saveRecords,
      verified:true,
      records:SHOPIFY_DNS_RECORDS.map((record) => ({...record})),
    };
  }
}

export function createSpaceshipDnsClientFromEnv(env = process.env, options = {}) {
  const apiKey = String(env.HERCULES_SPACESHIP_API_KEY || "").trim();
  const apiSecret = String(env.HERCULES_SPACESHIP_API_SECRET || "").trim();
  if (!apiKey || !apiSecret) return null;
  return new SpaceshipDnsClient({apiKey, apiSecret, ...options});
}
