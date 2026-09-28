import {
  createHmac,
  createHash,
  timingSafeEqual,
} from "node:crypto";

const POLICY_VERSION = "2.1.0";
const MAX_ROUTE_BYTES = 2048;
const MAX_SESSION_BYTES = 512;
const MAX_DELAY_MS = 1500;
const ZERO_HASH = "0".repeat(64);
const MIRAGE_TTL_MS = 15 * 60 * 1000;
const MIRAGE_FOCUS = new Set(["generic", "auth", "admin", "api", "storage", "billing"]);
const MIRAGE_ISOLATION = Object.freeze([
  "NO_EGRESS",
  "NO_PRODUCTION_CREDENTIALS",
  "NO_CUSTOMER_DATA",
  "NO_PAYMENT_KEYS",
  "NO_SIGNING_AUTHORITY",
]);

const NUMERIC_SIGNALS = Object.freeze([
  "authFailures",
  "routeProbes",
  "requestVelocity",
  "signatureMismatches",
]);

const BOOLEAN_SIGNALS = Object.freeze([
  "enumerationPattern",
  "honeytokenTouched",
  "credentialStuffing",
  "impossibleSequence",
  "privilegeBoundaryProbe",
]);

const SIGNAL_SET = new Set([...NUMERIC_SIGNALS, ...BOOLEAN_SIGNALS]);
const LEARNING_CONTROLS = new Set([
  "REVIEW_AUTH_ABUSE_CONTROLS",
  "REVIEW_DISCOVERY_DECEPTION_DENSITY",
  "REVIEW_REQUEST_VELOCITY_PROFILE",
  "REVIEW_SIGNATURE_VALIDATION_CONTROLS",
  "REVIEW_PRIVILEGE_BOUNDARY_CONTROLS",
  "REVIEW_HONEYTOKEN_COVERAGE",
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function keyBytes(hmacKey) {
  const value = Buffer.isBuffer(hmacKey)
    ? Buffer.from(hmacKey)
    : Buffer.from(String(hmacKey ?? ""), "utf8");
  if (value.length < 32) throw new Error("hmacKey must be at least 32 bytes");
  return value;
}

function mac(hmacKey, value) {
  return createHmac("sha256", keyBytes(hmacKey))
    .update(stableJson(value))
    .digest("hex");
}

function safeEqualHex(a, b) {
  if (!/^[a-f0-9]{64}$/i.test(String(a ?? ""))) return false;
  if (!/^[a-f0-9]{64}$/i.test(String(b ?? ""))) return false;
  const left = Buffer.from(String(a), "hex");
  const right = Buffer.from(String(b), "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function boundedString(value, name, maxBytes, { required = false } = {}) {
  const output = String(value ?? "").trim();
  if (required && !output) throw new Error(`${name} required`);
  if (Buffer.byteLength(output, "utf8") > maxBytes) throw new Error(`${name} too large`);
  return output;
}

function normalizeSignals(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("signals must be an object");
  }

  for (const key of Object.keys(input)) {
    if (!SIGNAL_SET.has(key)) throw new Error(`unsupported signal: ${key}`);
  }

  const signals = {};
  for (const key of NUMERIC_SIGNALS) {
    const raw = input[key] ?? 0;
    if (!Number.isFinite(raw) || raw < 0 || raw > 1_000_000) {
      throw new Error(`invalid ${key}`);
    }
    signals[key] = Math.floor(raw);
  }

  for (const key of BOOLEAN_SIGNALS) {
    const raw = input[key] ?? false;
    if (typeof raw !== "boolean") throw new Error(`invalid ${key}`);
    signals[key] = raw;
  }

  return Object.freeze(signals);
}

function normalizeEvent(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("event must be an object");
  }

  const sessionId = boundedString(
    input.sessionId,
    "sessionId",
    MAX_SESSION_BYTES,
    { required: true },
  );
  const route = boundedString(input.route || "/", "route", MAX_ROUTE_BYTES, { required: true });
  const signals = normalizeSignals(input.signals ?? {});
  return Object.freeze({ sessionId, route, signals });
}

function calculateRiskScore(signals) {
  if (signals.honeytokenTouched) return 100;

  let score = 0;
  score += Math.min(24, signals.authFailures * 3);
  score += Math.min(20, Math.floor(signals.routeProbes * 1.2));
  score += signals.requestVelocity >= 200
    ? 25
    : signals.requestVelocity >= 80
      ? 15
      : signals.requestVelocity >= 30
        ? 8
        : 0;
  score += Math.min(20, signals.signatureMismatches * 5);
  if (signals.enumerationPattern) score += 25;
  if (signals.credentialStuffing) score += 35;
  if (signals.impossibleSequence) score += 30;
  if (signals.privilegeBoundaryProbe) score += 35;

  return Math.min(100, score);
}

function evidenceFamilies(signals) {
  const families = [];
  if (signals.authFailures > 0 || signals.credentialStuffing) families.push("identity");
  if (signals.routeProbes > 0 || signals.enumerationPattern) families.push("discovery");
  if (signals.requestVelocity > 0) families.push("request");
  if (signals.signatureMismatches > 0) families.push("integrity");
  if (signals.impossibleSequence || signals.privilegeBoundaryProbe) families.push("behavioral-boundary");
  if (signals.honeytokenTouched) families.push("honeytoken");
  return Object.freeze(families);
}

function classify(score) {
  if (score >= 85) {
    return {
      disposition: "CONTAIN",
      severity: "CRITICAL",
      routeMode: "DECOY",
      delayMs: MAX_DELAY_MS,
      actions: [
        "LOG",
        "ISOLATE_SESSION",
        "DECOY_ROUTE",
        "ROTATE_HONEYTOKENS",
        "EVIDENCE_CAPTURE",
      ],
    };
  }

  if (score >= 60) {
    return {
      disposition: "QUARANTINE",
      severity: "HIGH",
      routeMode: "DECOY",
      delayMs: Math.min(MAX_DELAY_MS, Math.max(250, score * 12)),
      actions: [
        "LOG",
        "TARPIT",
        "RATE_LIMIT",
        "DECOY_ROUTE",
        "ISSUE_HONEYTOKEN",
        "EVIDENCE_CAPTURE",
      ],
    };
  }

  if (score >= 30) {
    return {
      disposition: "THROTTLE",
      severity: "ELEVATED",
      routeMode: "REAL",
      delayMs: Math.min(750, Math.max(100, score * 8)),
      actions: ["LOG", "TARPIT", "RATE_LIMIT"],
    };
  }

  return {
    disposition: "OBSERVE",
    severity: "NORMAL",
    routeMode: "REAL",
    delayMs: 0,
    actions: ["LOG"],
  };
}

function applyFalsePositiveGovernor(policy, score, signals) {
  const families = evidenceFamilies(signals);
  const independentEvidenceFamilies = families.filter((family) => family !== "honeytoken").length;
  const honeytokenOverride = signals.honeytokenTouched === true;
  const deceptionRequested = policy.routeMode === "DECOY";
  const deceptionAllowed = !deceptionRequested
    || honeytokenOverride
    || independentEvidenceFamilies >= 2;

  if (deceptionRequested && !deceptionAllowed) {
    return {
      policy: {
        disposition: "THROTTLE",
        severity: "ELEVATED",
        routeMode: "REAL",
        delayMs: Math.min(750, Math.max(100, score * 8)),
        actions: ["LOG", "TARPIT", "RATE_LIMIT", "EVIDENCE_CAPTURE"],
      },
      governor: {
        schema: "hercules.smokescreen.false-positive-governor.v1",
        requiredEvidenceFamilies: 2,
        independentEvidenceFamilies,
        evidenceFamilies: families,
        honeytokenOverride,
        deceptionRequested,
        deceptionAllowed: false,
      },
    };
  }

  return {
    policy,
    governor: {
      schema: "hercules.smokescreen.false-positive-governor.v1",
      requiredEvidenceFamilies: 2,
      independentEvidenceFamilies,
      evidenceFamilies: families,
      honeytokenOverride,
      deceptionRequested,
      deceptionAllowed: deceptionRequested ? true : false,
    },
  };
}

function freezeDecision(decision) {
  return Object.freeze({
    ...decision,
    actions: Object.freeze([...decision.actions]),
    signalSummary: Object.freeze({...decision.signalSummary}),
    governor: Object.freeze({
      ...decision.governor,
      evidenceFamilies: Object.freeze([...decision.governor.evidenceFamilies]),
    }),
  });
}

export function createSmokeScreenDecision(input = {}, options = {}) {
  const event = normalizeEvent(input);
  const key = keyBytes(options.hmacKey);
  const score = calculateRiskScore(event.signals);
  const rawPolicy = classify(score);
  const governed = applyFalsePositiveGovernor(rawPolicy, score, event.signals);
  const policy = governed.policy;
  const sessionFingerprint = mac(key, {
    namespace: "hercules.smokescreen.session.v1",
    sessionId: event.sessionId,
  }).slice(0, 32);
  const routeFingerprint = mac(key, {
    namespace: "hercules.smokescreen.route.v1",
    route: event.route,
  }).slice(0, 32);
  const decoyId = policy.routeMode === "DECOY"
    ? "decoy_" + mac(key, {
        namespace: "hercules.smokescreen.decoy.v1",
        sessionId: event.sessionId,
        route: event.route,
        policyVersion: POLICY_VERSION,
      }).slice(0, 24)
    : null;

  return freezeDecision({
    schema: "hercules.smokescreen.decision.v1",
    policyVersion: POLICY_VERSION,
    scope: "OWNED_INFRASTRUCTURE_ONLY",
    riskScore: score,
    severity: policy.severity,
    disposition: policy.disposition,
    routeMode: policy.routeMode,
    delayMs: policy.delayMs,
    actions: policy.actions,
    decoyId,
    sessionFingerprint,
    routeFingerprint,
    signalSummary: event.signals,
    governor: governed.governor,
    outboundCounterattack: false,
  });
}

function normalizeMirageFocus(value) {
  const focus = String(value ?? "generic").trim().toLowerCase();
  return MIRAGE_FOCUS.has(focus) ? focus : "generic";
}

function normalizeGeneration(value) {
  const generation = Number(value ?? 0);
  if (!Number.isInteger(generation) || generation < 0 || generation > 1_000_000) {
    throw new Error("generation must be an integer from 0 to 1000000");
  }
  return generation;
}

function assertDecoyDecision(decision = {}) {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    throw new Error("decision must be an object");
  }
  if (decision.scope !== "OWNED_INFRASTRUCTURE_ONLY") {
    throw new Error("decision scope must be owned infrastructure only");
  }
  if (decision.outboundCounterattack !== false) {
    throw new Error("outbound counterattack must remain disabled");
  }
  if (decision.routeMode !== "DECOY") {
    throw new Error("Mirage Fabric requires a decoy decision");
  }
  if (!/^decoy_[a-f0-9]{24}$/i.test(String(decision.decoyId ?? ""))) {
    throw new Error("valid decoyId required");
  }
}

export function createSmokeScreenEnforcementPlan(decision = {}) {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    throw new Error("decision must be an object");
  }
  if (decision.scope !== "OWNED_INFRASTRUCTURE_ONLY") {
    throw new Error("decision scope must be owned infrastructure only");
  }
  if (decision.outboundCounterattack !== false) {
    throw new Error("outbound counterattack must remain disabled");
  }

  if (decision.routeMode === "DECOY") {
    return Object.freeze({
      schema: "hercules.smokescreen.enforcement-plan.v2",
      policyVersion: POLICY_VERSION,
      mode: "MIRAGE",
      fallback: "DENY",
      requiredControls: MIRAGE_ISOLATION,
      realAssetAccess: false,
      executionAuthority: false,
      outboundCounterattack: false,
    });
  }

  if (decision.routeMode === "REAL") {
    return Object.freeze({
      schema: "hercules.smokescreen.enforcement-plan.v2",
      policyVersion: POLICY_VERSION,
      mode: "REAL",
      fallback: "PRESERVE_ROUTE",
      requiredControls: Object.freeze(["LOG"]),
      realAssetAccess: true,
      executionAuthority: false,
      outboundCounterattack: false,
    });
  }

  throw new Error("unsupported route mode");
}

export function createMirageFabric(decision = {}, context = {}, options = {}) {
  assertDecoyDecision(decision);
  const key = keyBytes(options.hmacKey);
  const generation = normalizeGeneration(context.generation);
  const focus = normalizeMirageFocus(context.focus);
  const now = typeof options.now === "function" ? options.now : Date.now;
  const ttlMs = options.ttlMs ?? MIRAGE_TTL_MS;
  if (!Number.isInteger(ttlMs) || ttlMs < 60_000 || ttlMs > 60 * 60 * 1000) {
    throw new Error("ttlMs must be an integer from 60000 to 3600000");
  }

  const createdAtMs = Number(now());
  if (!Number.isFinite(createdAtMs)) throw new Error("invalid clock");
  const seed = mac(key, {
    namespace: "hercules.smokescreen.mirage.v2",
    decoyId: decision.decoyId,
    generation,
    focus,
  });

  const namespace = "mz_" + seed.slice(0, 12);
  const syntheticRoutes = Object.freeze([
    "/ops/" + seed.slice(12, 20) + "/status",
    "/api/" + seed.slice(20, 28) + "/export",
    "/store/" + seed.slice(28, 36) + "/snapshot",
  ]);

  return Object.freeze({
    schema: "hercules.smokescreen.mirage.v2",
    policyVersion: POLICY_VERSION,
    decoyId: decision.decoyId,
    generation,
    focus,
    namespace,
    createdAt: new Date(createdAtMs).toISOString(),
    expiresAt: new Date(createdAtMs + ttlMs).toISOString(),
    networkPolicy: "ISOLATED_NO_EGRESS",
    dataPolicy: "SYNTHETIC_ONLY",
    fallback: "DENY",
    requiredControls: MIRAGE_ISOLATION,
    syntheticRoutes,
    honeytoken: "HNY_" + seed.slice(36, 60).toUpperCase(),
    syntheticRecords: 3 + (parseInt(seed.slice(60, 62), 16) % 10),
    realAssetAccess: false,
    executionAuthority: false,
    outboundCounterattack: false,
  });
}

export function evolveMirageFabric(fabric = {}, observation = {}, options = {}) {
  if (!fabric || typeof fabric !== "object" || Array.isArray(fabric)) {
    throw new Error("fabric must be an object");
  }
  if (
    fabric.schema !== "hercules.smokescreen.mirage.v2"
    || fabric.networkPolicy !== "ISOLATED_NO_EGRESS"
    || fabric.dataPolicy !== "SYNTHETIC_ONLY"
    || fabric.fallback !== "DENY"
    || fabric.realAssetAccess !== false
    || fabric.outboundCounterattack !== false
  ) {
    throw new Error("invalid or unsafe Mirage Fabric state");
  }

  const decision = {
    scope: "OWNED_INFRASTRUCTURE_ONLY",
    outboundCounterattack: false,
    routeMode: "DECOY",
    decoyId: fabric.decoyId,
  };
  return createMirageFabric(decision, {
    focus: observation.focus ?? fabric.focus,
    generation: normalizeGeneration(fabric.generation) + 1,
  }, options);
}


function digestHex(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function recommendation(control, reason, evidenceCount) {
  return Object.freeze({
    control,
    reason,
    evidenceCount,
    changeAuthority: "NONE",
  });
}

export function createEvidenceLockedLearningCapsule(chain = [], options = {}) {
  const key = keyBytes(options.hmacKey);
  if (!verifyAuditChain(chain, {hmacKey: key})) {
    throw new Error("valid SmokeScreen audit chain required");
  }

  const createdAt = new Date(options.createdAt ?? Date.now()).toISOString();
  const counts = {
    identity: 0,
    discovery: 0,
    request: 0,
    integrity: 0,
    boundary: 0,
    honeytoken: 0,
  };

  for (const entry of chain) {
    const signals = entry?.decision?.signalSummary ?? {};
    if ((signals.authFailures ?? 0) > 0 || signals.credentialStuffing === true) counts.identity += 1;
    if ((signals.routeProbes ?? 0) > 0 || signals.enumerationPattern === true) counts.discovery += 1;
    if ((signals.requestVelocity ?? 0) >= 30) counts.request += 1;
    if ((signals.signatureMismatches ?? 0) > 0) counts.integrity += 1;
    if (signals.impossibleSequence === true || signals.privilegeBoundaryProbe === true) counts.boundary += 1;
    if (signals.honeytokenTouched === true) counts.honeytoken += 1;
  }

  const recommendations = [];
  if (counts.identity) recommendations.push(recommendation(
    "REVIEW_AUTH_ABUSE_CONTROLS",
    "Observed identity-abuse evidence warrants review of authentication throttling and credential defenses.",
    counts.identity,
  ));
  if (counts.discovery) recommendations.push(recommendation(
    "REVIEW_DISCOVERY_DECEPTION_DENSITY",
    "Observed reconnaissance evidence warrants review of deception placement and discovery trip points.",
    counts.discovery,
  ));
  if (counts.request) recommendations.push(recommendation(
    "REVIEW_REQUEST_VELOCITY_PROFILE",
    "Observed elevated request velocity warrants review of rate-limit profiles.",
    counts.request,
  ));
  if (counts.integrity) recommendations.push(recommendation(
    "REVIEW_SIGNATURE_VALIDATION_CONTROLS",
    "Observed signature mismatches warrant review of request-integrity controls.",
    counts.integrity,
  ));
  if (counts.boundary) recommendations.push(recommendation(
    "REVIEW_PRIVILEGE_BOUNDARY_CONTROLS",
    "Observed boundary-probing evidence warrants review of privilege and authorization controls.",
    counts.boundary,
  ));
  if (counts.honeytoken) recommendations.push(recommendation(
    "REVIEW_HONEYTOKEN_COVERAGE",
    "Honeytoken interaction warrants review of token placement and adjacent containment controls.",
    counts.honeytoken,
  ));

  const evidence = {
    chainHead: chain.at(-1)?.chainHash ?? ZERO_HASH,
    sampleCount: chain.length,
    counts,
  };
  const unsigned = {
    schema: "hercules.smokescreen.learning-capsule.v1",
    policyVersion: POLICY_VERSION,
    scope: "OWNED_INFRASTRUCTURE_ONLY",
    createdAt,
    evidenceDigest: digestHex(evidence),
    chainHead: evidence.chainHead,
    sampleCount: evidence.sampleCount,
    recommendations,
    executionAuthority: false,
    autoApply: false,
    requiresReview: true,
    outboundCounterattack: false,
  };
  return Object.freeze({
    ...unsigned,
    recommendations: Object.freeze([...recommendations]),
    signature: mac(key, unsigned),
  });
}

export function verifyEvidenceLockedLearningCapsule(capsule = {}, options = {}) {
  const key = keyBytes(options.hmacKey);
  if (!capsule || typeof capsule !== "object" || Array.isArray(capsule)) return false;
  if (
    capsule.schema !== "hercules.smokescreen.learning-capsule.v1"
    || capsule.scope !== "OWNED_INFRASTRUCTURE_ONLY"
    || capsule.executionAuthority !== false
    || capsule.autoApply !== false
    || capsule.requiresReview !== true
    || capsule.outboundCounterattack !== false
    || !Array.isArray(capsule.recommendations)
  ) return false;

  for (const item of capsule.recommendations) {
    if (
      !item
      || typeof item !== "object"
      || !LEARNING_CONTROLS.has(item.control)
      || item.changeAuthority !== "NONE"
      || !Number.isInteger(item.evidenceCount)
      || item.evidenceCount < 1
    ) return false;
  }

  const {signature, ...unsigned} = capsule;
  return safeEqualHex(signature, mac(key, unsigned));
}

function auditPayload(entry) {
  return {
    schema: entry.schema,
    index: entry.index,
    recordedAt: entry.recordedAt,
    previousHash: entry.previousHash,
    eventFingerprint: entry.eventFingerprint,
    decision: entry.decision,
  };
}

export function verifyAuditChain(chain = [], options = {}) {
  if (!Array.isArray(chain)) return false;
  const key = keyBytes(options.hmacKey);
  if (chain.length === 0) return true;

  let expectedPrevious = chain[0]?.previousHash;
  if (!/^[a-f0-9]{64}$/i.test(String(expectedPrevious ?? ""))) return false;

  for (let index = 0; index < chain.length; index += 1) {
    const entry = chain[index];
    if (!entry || typeof entry !== "object") return false;
    if (entry.index !== index + (chain[0]?.index ?? 0)) return false;
    if (!safeEqualHex(entry.previousHash, expectedPrevious)) return false;
    const expectedHash = mac(key, auditPayload(entry));
    if (!safeEqualHex(entry.chainHash, expectedHash)) return false;
    expectedPrevious = entry.chainHash;
  }

  return true;
}

export function createSmokeScreenAgent(options = {}) {
  const key = keyBytes(options.hmacKey);
  const now = typeof options.now === "function" ? options.now : Date.now;
  const requestedLimit = options.maxAuditEntries ?? 4096;
  if (!Number.isInteger(requestedLimit) || requestedLimit < 16 || requestedLimit > 100_000) {
    throw new Error("maxAuditEntries must be an integer from 16 to 100000");
  }

  const records = [];
  let nextIndex = 0;
  let headHash = ZERO_HASH;

  return Object.freeze({
    observe(input = {}) {
      const event = normalizeEvent(input);
      const decision = createSmokeScreenDecision(event, { hmacKey: key });
      const eventFingerprint = mac(key, {
        namespace: "hercules.smokescreen.event.v1",
        event,
      });
      const entry = {
        schema: "hercules.smokescreen.audit.v1",
        index: nextIndex,
        recordedAt: new Date(Number(now())).toISOString(),
        previousHash: headHash,
        eventFingerprint,
        decision,
      };
      const finalized = Object.freeze({
        ...entry,
        chainHash: mac(key, auditPayload(entry)),
      });

      records.push(finalized);
      nextIndex += 1;
      headHash = finalized.chainHash;
      if (records.length > requestedLimit) records.shift();

      return decision;
    },

    audit() {
      return records.map((entry) => structuredClone(entry));
    },

    checkpoint() {
      return Object.freeze({
        schema: "hercules.smokescreen.checkpoint.v1",
        retainedEntries: records.length,
        firstIndex: records[0]?.index ?? nextIndex,
        anchorHash: records[0]?.previousHash ?? headHash,
        headHash,
      });
    },

    plan(decision) {
      return createSmokeScreenEnforcementPlan(decision);
    },

    mirage(decision, context = {}) {
      return createMirageFabric(decision, context, { hmacKey: key, now });
    },

    evolveMirage(fabric, observation = {}) {
      return evolveMirageFabric(fabric, observation, { hmacKey: key, now });
    },
  });
}

export const SMOKESCREEN_POLICY = Object.freeze({
  schema: "hercules.smokescreen.policy.v1",
  version: POLICY_VERSION,
  scope: "OWNED_INFRASTRUCTURE_ONLY",
  maxDelayMs: MAX_DELAY_MS,
  activeCounterattack: false,
  mirageFabric: true,
  mirageNetworkPolicy: "ISOLATED_NO_EGRESS",
  mirageDataPolicy: "SYNTHETIC_ONLY",
  mirageFallback: "DENY",
  falsePositiveGovernor: true,
  minIndependentEvidenceFamiliesForDeception: 2,
  evidenceLockedLearning: true,
  learningAutoApply: false,
  supportedSignals: Object.freeze([...SIGNAL_SET].sort()),
});


export async function runSmokeScreenWatcher({
  source,
  agent,
  onDecision = async () => {},
} = {}) {
  if (!source || typeof source[Symbol.asyncIterator] !== "function") {
    throw new Error("source must be an async iterable");
  }
  if (!agent || typeof agent.observe !== "function") {
    throw new Error("agent with observe() required");
  }
  if (typeof onDecision !== "function") {
    throw new Error("onDecision must be a function");
  }

  let observed = 0;
  let quarantined = 0;
  let contained = 0;

  for await (const event of source) {
    const decision = agent.observe(event);
    observed += 1;
    if (decision.disposition === "QUARANTINE") quarantined += 1;
    if (decision.disposition === "CONTAIN") contained += 1;
    await onDecision(decision);
  }

  return Object.freeze({
    schema: "hercules.smokescreen.watcher-summary.v1",
    observed,
    quarantined,
    contained,
    scope: "OWNED_INFRASTRUCTURE_ONLY",
  });
}
