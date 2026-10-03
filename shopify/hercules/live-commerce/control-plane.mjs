import crypto from "node:crypto";

const transitions = {
  draft: new Set(["scheduled", "cancelled"]),
  scheduled: new Set(["prelive", "cancelled"]),
  prelive: new Set(["live", "cancelled"]),
  live: new Set(["paused", "ended"]),
  paused: new Set(["live", "ended"]),
  ended: new Set(["archived"]),
  cancelled: new Set(["archived"]),
  archived: new Set()
};
const terminalStates = new Set(["ended", "cancelled", "archived"]);
const scopePattern = /^[a-z][a-z0-9:_-]{0,63}$/;
const MAX_TICKET_TTL_SECONDS = 900;
const MAX_TICKET_BYTES = 4096;

function requiredText(value, code, maxLength = 256) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength) throw new Error(code);
  return text;
}

function assertShop(shopDomain) {
  const shop = requiredText(shopDomain, "invalid_shop_domain", 253).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
    throw new Error("invalid_shop_domain");
  }
  return shop;
}

function assertVersion(value, code = "invalid_live_version") {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) throw new Error(code);
  return version;
}

function nextVersion(value) {
  const version = assertVersion(value);
  if (version === Number.MAX_SAFE_INTEGER) throw new Error("live_version_exhausted");
  return version + 1;
}

function assertSecret(secret) {
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("live_ticket_secret_too_short");
  }
  return secret;
}

function clone(value) {
  return structuredClone(value);
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(input, secret) {
  return crypto.createHmac("sha256", secret).update(input).digest("base64url");
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes)) throw new Error("invalid_live_ticket_scopes");
  const values = scopes.map((scope) => requiredText(scope, "invalid_live_ticket_scopes", 64));
  if (values.some((scope) => !scopePattern.test(scope))) {
    throw new Error("invalid_live_ticket_scopes");
  }
  return [...new Set(values)].sort();
}

export function createLiveSession({ id, shopDomain, title } = {}) {
  return {
    id: requiredText(id, "live_session_fields_required", 128),
    shopDomain: assertShop(shopDomain),
    title: requiredText(title, "live_session_fields_required", 160),
    state: "draft",
    version: 1,
    commerceEnabled: false,
    pin: null
  };
}

export function transitionLiveSession(session, { from, to } = {}) {
  if (!session || session.state !== from) throw new Error("live_state_conflict");
  const version = nextVersion(session.version);
  if (!transitions[from]?.has(to)) throw new Error("invalid_live_transition");
  return { ...clone(session), state: to, version, commerceEnabled: false };
}

export function pinProduct(session, { variantGid, expectedVersion, durationSeconds = 300 } = {}) {
  if (!session || !Object.hasOwn(transitions, session.state) || terminalStates.has(session.state)) {
    throw new Error("live_session_not_pinnable");
  }
  const version = assertVersion(session.version);
  if (version !== assertVersion(expectedVersion, "version_conflict")) throw new Error("version_conflict");
  if (version === Number.MAX_SAFE_INTEGER) throw new Error("live_version_exhausted");
  const variant = requiredText(variantGid, "invalid_shopify_variant_gid", 128);
  if (!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variant)) {
    throw new Error("invalid_shopify_variant_gid");
  }
  const duration = Number(durationSeconds);
  if (!Number.isSafeInteger(duration) || duration < 1 || duration > 3600) {
    throw new Error("invalid_pin_duration");
  }
  return {
    ...clone(session),
    version: version + 1,
    commerceEnabled: false,
    pin: { variantGid: variant, durationSeconds: duration }
  };
}

export async function issueRealtimeTicket({
  eventId,
  audience,
  scopes = [],
  expiresInSeconds = 300,
  secret,
  now = Math.floor(Date.now() / 1000)
} = {}) {
  const key = assertSecret(secret);
  const ttl = Number(expiresInSeconds);
  const issuedAt = Number(now);
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > MAX_TICKET_TTL_SECONDS) {
    throw new Error("invalid_live_ticket_ttl");
  }
  if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) throw new Error("invalid_live_ticket_time");
  if (!Number.isSafeInteger(issuedAt + ttl)) throw new Error("invalid_live_ticket_time");
  const claims = {
    eventId: requiredText(eventId, "live_ticket_claims_required", 128),
    audience: requiredText(audience, "live_ticket_claims_required", 128),
    scopes: normalizeScopes(scopes),
    iat: issuedAt,
    exp: issuedAt + ttl
  };
  const payload = encodeBase64Url(JSON.stringify(claims));
  return payload + "." + sign(payload, key);
}

export async function verifyRealtimeTicket(ticket, {
  secret,
  eventId,
  expectedAudience,
  requiredScope,
  now = Math.floor(Date.now() / 1000)
} = {}) {
  const key = assertSecret(secret);
  const audience = requiredText(expectedAudience, "live_ticket_audience_required", 128);
  const expectedEventId = requiredText(eventId, "live_ticket_event_required", 128);
  const currentTime = Number(now);
  if (!Number.isSafeInteger(currentTime) || currentTime < 0) throw new Error("invalid_live_ticket_time");
  if (typeof ticket !== "string" || Buffer.byteLength(ticket, "utf8") > MAX_TICKET_BYTES) {
    throw new Error("invalid_live_ticket");
  }
  const segments = ticket.split(".");
  if (segments.length !== 2 || !segments.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) {
    throw new Error("invalid_live_ticket");
  }
  const [payload, signature] = segments;
  const expectedSignature = sign(payload, key);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expectedSignature);
  if (actualBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(actualBytes, expectedBytes)) {
    throw new Error("invalid_live_ticket");
  }

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("invalid_live_ticket");
  }
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) throw new Error("invalid_live_ticket");
  if (claims.eventId !== expectedEventId) throw new Error("live_ticket_event_mismatch");
  if (claims.audience !== audience) throw new Error("live_ticket_audience_mismatch");
  if (!Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || claims.iat < 0 || claims.exp <= claims.iat) {
    throw new Error("invalid_live_ticket_time");
  }
  if (claims.iat > currentTime || claims.exp - claims.iat > MAX_TICKET_TTL_SECONDS) {
    throw new Error("invalid_live_ticket_time");
  }
  if (currentTime >= claims.exp) throw new Error("expired_live_ticket");
  const scopes = normalizeScopes(claims.scopes);
  if (scopes.length !== claims.scopes.length || scopes.some((scope, index) => scope !== claims.scopes[index])) {
    throw new Error("invalid_live_ticket_scopes");
  }
  if (requiredScope !== undefined) {
    const scope = requiredText(requiredScope, "live_ticket_scope_denied", 64);
    if (!scopePattern.test(scope) || !scopes.includes(scope)) throw new Error("live_ticket_scope_denied");
  }
  return claims;
}
