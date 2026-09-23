import {
  validateEvaluationResult,
  validateEvaluationSuite,
} from "./schema.mjs";

function passes(op, actual, expected) {
  if (op === "gte") return actual >= expected;
  if (op === "lte") return actual <= expected;
  return false;
}

export function scoreEvaluation({suite: suiteInput, result: resultInput}) {
  const suiteChecked = validateEvaluationSuite(suiteInput);
  if (!suiteChecked.ok) throw new Error("invalid evaluation suite: " + suiteChecked.errors.join("; "));

  const resultChecked = validateEvaluationResult(resultInput);
  if (!resultChecked.ok) throw new Error("invalid evaluation result: " + resultChecked.errors.join("; "));

  if (resultChecked.result.suiteId !== suiteChecked.suite.id) {
    throw new Error("evaluation result references a different suite");
  }
  if (resultChecked.result.suiteFingerprint !== suiteChecked.fingerprint) {
    throw new Error("evaluation result suite fingerprint mismatch");
  }

  const checks = suiteChecked.suite.thresholds.map((threshold) => {
    const actual = resultChecked.result.metrics[threshold.metric];
    const ok = typeof actual === "number" && Number.isFinite(actual)
      ? passes(threshold.op, actual, threshold.value)
      : false;
    return {...threshold, actual: actual ?? null, ok};
  });

  return {
    ok: checks.every((check) => check.ok),
    checks,
    suiteFingerprint: suiteChecked.fingerprint,
    resultFingerprint: resultChecked.fingerprint,
  };
}
