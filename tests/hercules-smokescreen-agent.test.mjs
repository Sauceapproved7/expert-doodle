import test from "node:test";
import assert from "node:assert/strict";
import {
  createSmokeScreenAgent,
  createSmokeScreenDecision,
  verifyAuditChain,
  runSmokeScreenWatcher,
} from "../hercules-runtime/smokescreen-agent.mjs";
import {
  createCommandRequest,
  listCommandCapabilities,
  routeCommand,
} from "../hercules-runtime/command-surface.mjs";

const key = "0123456789abcdef0123456789abcdef";

test("benign activity remains on the real path without deception", () => {
  const decision = createSmokeScreenDecision({
    sessionId: "session-benign",
    route: "/dashboard",
    signals: { authFailures: 0, routeProbes: 0, requestVelocity: 3 },
  }, { hmacKey: key });

  assert.equal(decision.disposition, "OBSERVE");
  assert.equal(decision.routeMode, "REAL");
  assert.equal(decision.delayMs, 0);
  assert.deepEqual(decision.actions, ["LOG"]);
});

test("reconnaissance is contained with bounded friction and a decoy route", () => {
  const decision = createSmokeScreenDecision({
    sessionId: "session-recon",
    route: "/admin",
    signals: {
      authFailures: 4,
      routeProbes: 12,
      requestVelocity: 90,
      enumerationPattern: true,
    },
  }, { hmacKey: key });

  assert.equal(decision.disposition, "QUARANTINE");
  assert.equal(decision.routeMode, "DECOY");
  assert.ok(decision.delayMs > 0);
  assert.ok(decision.delayMs <= 1500);
  assert.ok(decision.actions.includes("TARPIT"));
  assert.ok(decision.actions.includes("DECOY_ROUTE"));
});

test("honeytoken contact triggers immediate session isolation without hack-back", () => {
  const decision = createSmokeScreenDecision({
    sessionId: "session-critical",
    route: "/internal/export",
    signals: {
      honeytokenTouched: true,
      authFailures: 1,
      routeProbes: 1,
      requestVelocity: 5,
    },
  }, { hmacKey: key });

  assert.equal(decision.disposition, "CONTAIN");
  assert.equal(decision.routeMode, "DECOY");
  assert.ok(decision.actions.includes("ISOLATE_SESSION"));
  assert.ok(decision.actions.includes("ROTATE_HONEYTOKENS"));
  assert.equal(decision.scope, "OWNED_INFRASTRUCTURE_ONLY");
  assert.equal(
    decision.actions.some((action) => /hack|exploit|scan_remote|remote_access/i.test(action)),
    false,
  );
});

test("decoy identifiers are deterministic fingerprints and do not expose raw session ids", () => {
  const event = {
    sessionId: "secret-session-value",
    route: "/api/private",
    signals: { routeProbes: 20, requestVelocity: 120, enumerationPattern: true },
  };
  const one = createSmokeScreenDecision(event, { hmacKey: key });
  const two = createSmokeScreenDecision(event, { hmacKey: key });

  assert.equal(one.decoyId, two.decoyId);
  assert.match(one.decoyId, /^decoy_[a-f0-9]{24}$/);
  assert.equal(JSON.stringify(one).includes(event.sessionId), false);
  assert.equal(JSON.stringify(one).includes(key), false);
});

test("audit chain is tamper evident", () => {
  const agent = createSmokeScreenAgent({ hmacKey: key, now: () => 1_790_000_000_000 });
  agent.observe({
    sessionId: "s1",
    route: "/login",
    signals: { authFailures: 8, requestVelocity: 70 },
  });
  agent.observe({
    sessionId: "s1",
    route: "/admin",
    signals: { routeProbes: 30, enumerationPattern: true },
  });

  const chain = agent.audit();
  assert.equal(chain.length, 2);
  assert.equal(verifyAuditChain(chain, { hmacKey: key }), true);

  const tampered = structuredClone(chain);
  tampered[1].decision.disposition = "OBSERVE";
  assert.equal(verifyAuditChain(tampered, { hmacKey: key }), false);
});

test("malformed and oversized events fail closed", () => {
  assert.throws(
    () => createSmokeScreenDecision({ sessionId: "", route: "/", signals: {} }, { hmacKey: key }),
    /sessionId required/,
  );
  assert.throws(
    () => createSmokeScreenDecision({
      sessionId: "x",
      route: "/" + "a".repeat(5000),
      signals: {},
    }, { hmacKey: key }),
    /route too large/,
  );
  assert.throws(
    () => createSmokeScreenDecision({
      sessionId: "x",
      route: "/",
      signals: { authFailures: -1 },
    }, { hmacKey: key }),
    /invalid authFailures/,
  );
});

test("unified Hercules command surface exposes SmokeScreen without execution authority", () => {
  assert.ok(listCommandCapabilities().includes("security.smokescreen"));
  const command = createCommandRequest({
    intentId: "intent-smokescreen-1",
    capability: "security.smokescreen",
    payload: { eventFingerprint: "abc" },
  });
  const routed = routeCommand(command);
  assert.equal(routed.route, "hercules-runtime");
  assert.equal(routed.executionAuthority, false);
});


test("watcher consumes an authorized telemetry stream and emits bounded decisions", async () => {
  async function* source() {
    yield {
      sessionId: "stream-safe",
      route: "/health",
      signals: { requestVelocity: 2 },
    };
    yield {
      sessionId: "stream-recon",
      route: "/admin",
      signals: {
        authFailures: 4,
        routeProbes: 12,
        requestVelocity: 90,
        enumerationPattern: true,
      },
    };
  }

  const decisions = [];
  const agent = createSmokeScreenAgent({
    hmacKey: key,
    now: () => 1_790_000_000_000,
  });
  const summary = await runSmokeScreenWatcher({
    source: source(),
    agent,
    onDecision: async (decision) => decisions.push(decision),
  });

  assert.equal(summary.observed, 2);
  assert.equal(summary.quarantined, 1);
  assert.equal(summary.contained, 0);
  assert.deepEqual(
    decisions.map((decision) => decision.disposition),
    ["OBSERVE", "QUARANTINE"],
  );
});
