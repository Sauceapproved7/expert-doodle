const REQUIRED_GATES = Object.freeze(["tests", "security", "provenance", "owner-approval"]);

function normalizeGoal(goal) {
  if (typeof goal !== "string" || !goal.trim()) throw new TypeError("goal is required");
  return goal.trim();
}

export function createPrototypePlan({ goal, targetFps = 60, runtime = "local-first" } = {}) {
  const normalizedGoal = normalizeGoal(goal);
  if (!Number.isFinite(targetFps) || targetFps <= 0 || targetFps > 240) {
    throw new RangeError("targetFps must be between 1 and 240");
  }
  return Object.freeze({
    kind: "hercules-rapid-prototype",
    owner: "SauceApproved enterprise LLC",
    goal: normalizedGoal,
    targetFps,
    runtime,
    productionReady: false,
    requiredGates: [...REQUIRED_GATES],
    principles: Object.freeze({
      prototypeFast: true,
      localFirst: true,
      hardwareAware: true,
      thirdPartyCodeByDefault: false,
      failClosed: true,
    }),
  });
}

export function evaluatePrototypeGate({
  tests = false,
  security = false,
  provenance = false,
  ownerApproval = false,
} = {}) {
  const checks = Object.freeze({ tests: !!tests, security: !!security, provenance: !!provenance, ownerApproval: !!ownerApproval });
  const missing = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  return Object.freeze({ allowed: missing.length === 0, checks, missing });
}

export { REQUIRED_GATES };
