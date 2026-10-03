const IDENT = /^[a-z][a-z0-9-]{1,63}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function text(value) {
  return String(value ?? "").trim();
}

function unit(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function sameAction(a, b) {
  return text(a?.type) === text(b?.type) && text(a?.target) === text(b?.target);
}

export function validateExperience(input = {}) {
  const experience = {
    id: text(input.id),
    state: input.state && typeof input.state === "object" ? structuredClone(input.state) : {},
    action: input.action && typeof input.action === "object" ? structuredClone(input.action) : {},
    outcome: input.outcome && typeof input.outcome === "object" ? structuredClone(input.outcome) : {},
    reward: input.reward && typeof input.reward === "object" ? structuredClone(input.reward) : {},
    source: input.source && typeof input.source === "object" ? structuredClone(input.source) : {},
    createdAt: text(input.createdAt),
  };
  const errors = [];

  if (!IDENT.test(experience.id)) errors.push("invalid experience id");
  if (!text(experience.action.type)) errors.push("action.type is required");
  if (!text(experience.action.target)) errors.push("action.target is required");
  for (const metric of ["quality", "reliability", "safety"]) {
    if (!unit(experience.reward[metric])) errors.push("reward." + metric + " must be between 0 and 1");
  }
  if (!["observed", "sandbox", "human-approved"].includes(text(experience.source.kind))) {
    errors.push("source.kind must be observed, sandbox, or human-approved");
  }
  if (!SHA256.test(text(experience.source.evidenceSha256))) {
    errors.push("source.evidenceSha256 must be a lowercase SHA-256");
  }
  if (!experience.createdAt) errors.push("createdAt is required");

  return {ok: errors.length === 0, errors, experience};
}

export function scoreExperience(input) {
  const checked = validateExperience(input);
  if (!checked.ok) return {eligible: false, score: 0, errors: checked.errors};

  const {quality, reliability, safety} = checked.experience.reward;
  if (safety < 0.8) {
    return {eligible: false, score: 0, errors: ["safety reward below hard gate"]};
  }

  return {
    eligible: true,
    score: Number((quality * 0.4 + reliability * 0.35 + safety * 0.25).toFixed(6)),
    errors: [],
  };
}

export function evaluateCandidateAction({candidate, experiences = [], minimumSupport = 3} = {}) {
  const reasons = [];
  if (!candidate || !text(candidate.type) || !text(candidate.target)) {
    return {ok: false, mode: "recommendation-only", support: 0, score: 0, reasons: ["candidate action is incomplete"]};
  }
  if (!Number.isInteger(minimumSupport) || minimumSupport < 1) {
    return {ok: false, mode: "recommendation-only", support: 0, score: 0, reasons: ["minimumSupport must be a positive integer"]};
  }

  const eligible = experiences
    .map((experience) => ({experience, scored: scoreExperience(experience)}))
    .filter(({experience, scored}) => scored.eligible && sameAction(experience.action, candidate));

  if (eligible.length < minimumSupport) reasons.push("insufficient dataset support for candidate action");
  if (text(candidate.target).toLowerCase() === "production") {
    reasons.push("production actions require external authorization and cannot be promoted by offline learning");
  }

  const score = eligible.length
    ? Number((eligible.reduce((sum, item) => sum + item.scored.score, 0) / eligible.length).toFixed(6))
    : 0;

  return {
    ok: reasons.length === 0,
    mode: "recommendation-only",
    support: eligible.length,
    score,
    reasons,
  };
}
