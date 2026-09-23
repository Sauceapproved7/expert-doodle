import {validateCheckpoint} from "./schema.mjs";
import {scoreEvaluation} from "./evaluation.mjs";

export function decideActivation({
  model,
  checkpoint: checkpointInput,
  evaluations,
  requiredSuites,
  runtime,
}) {
  const reasons = [];
  const checkpointChecked = validateCheckpoint(checkpointInput);

  if (!checkpointChecked.ok) {
    return {ok: false, reasons: checkpointChecked.errors.map((x) => "checkpoint: " + x)};
  }

  const checkpoint = checkpointChecked.checkpoint;

  if (!model || model.id !== checkpoint.modelId) reasons.push("checkpoint model does not match model manifest");
  if (!Array.isArray(requiredSuites) || requiredSuites.length === 0) reasons.push("at least one required evaluation suite is required");
  if (!Array.isArray(evaluations)) reasons.push("evaluations must be an array");
  if (!runtime || !["http", "embedded"].includes(runtime.kind)) reasons.push("routeable runtime is required");
  if (runtime?.kind === "http" && !runtime.endpoint) reasons.push("http runtime endpoint is required");

  const scored = [];
  if (Array.isArray(requiredSuites) && Array.isArray(evaluations)) {
    for (const suite of requiredSuites) {
      const result = evaluations.find((item) => item?.suiteId === suite?.id);
      if (!result) {
        reasons.push("missing evaluation result for suite: " + (suite?.id ?? "<unknown>"));
        continue;
      }
      if (result.checkpointSha256 !== checkpoint.artifactSha256) {
        reasons.push("evaluation checkpoint mismatch for suite: " + suite.id);
        continue;
      }
      try {
        const score = scoreEvaluation({suite, result});
        scored.push({suiteId: suite.id, ...score});
        if (!score.ok) reasons.push("evaluation thresholds failed for suite: " + suite.id);
      } catch (error) {
        reasons.push("evaluation invalid for suite " + (suite?.id ?? "<unknown>") + ": " + error.message);
      }
    }
  }

  if (reasons.length) return {ok: false, reasons, scored};

  return {
    ok: true,
    reasons: [],
    scored,
    activatedModel: {
      ...structuredClone(model),
      state: "active",
      checkpoint: "sha256:" + checkpoint.artifactSha256,
      runtime: structuredClone(runtime),
      provenance: [
        model.provenance,
        "job:" + checkpoint.jobId,
        "checkpoint:" + checkpoint.id,
        "checkpoint-fingerprint:" + checkpointChecked.fingerprint,
      ].filter(Boolean).join(" | "),
    },
  };
}
