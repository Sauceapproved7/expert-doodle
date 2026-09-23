const WORD = /[a-z0-9]+/g;

export function tokenizeGuardText(text) {
  return (String(text).toLowerCase().match(WORD) ?? []).filter((token) => token.length > 1);
}

export function trainGuardClassifier(records, {alpha = 1} = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new TypeError("guard training records are required");
  }
  if (!(alpha > 0)) throw new TypeError("alpha must be positive");

  const labels = [...new Set(records.map((record) => String(record.label)))].sort();
  const vocabulary = new Set();
  const docsPerLabel = Object.fromEntries(labels.map((label) => [label, 0]));
  const tokenTotals = Object.fromEntries(labels.map((label) => [label, 0]));
  const tokenCounts = Object.fromEntries(labels.map((label) => [label, Object.create(null)]));

  for (const record of records) {
    const label = String(record.label);
    if (!labels.includes(label)) throw new TypeError("unknown guard label");
    docsPerLabel[label] += 1;

    for (const token of tokenizeGuardText(record.text)) {
      vocabulary.add(token);
      tokenTotals[label] += 1;
      tokenCounts[label][token] = (tokenCounts[label][token] ?? 0) + 1;
    }
  }

  return {
    format: "hercules-native-guard-naive-bayes/0.1",
    algorithm: "multinomial-naive-bayes",
    task: "safety",
    alpha,
    labels,
    vocabulary: [...vocabulary].sort(),
    totalDocuments: records.length,
    docsPerLabel,
    tokenTotals,
    tokenCounts,
  };
}

export function scoreGuardAction(model, text) {
  const tokens = tokenizeGuardText(text);
  const vocabSize = Math.max(1, model.vocabulary.length);
  const scores = {};

  for (const label of model.labels) {
    let score = Math.log(model.docsPerLabel[label] / model.totalDocuments);
    const denom = model.tokenTotals[label] + model.alpha * vocabSize;
    for (const token of tokens) {
      score += Math.log(((model.tokenCounts[label][token] ?? 0) + model.alpha) / denom);
    }
    scores[label] = score;
  }
  return scores;
}

export function classifyGuardAction(model, text) {
  const scores = scoreGuardAction(model, text);
  const decision = Object.entries(scores)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];

  return {decision, scores};
}

export function evaluateGuardClassifier(model, records) {
  let correct = 0;
  const rows = records.map((record) => {
    const result = classifyGuardAction(model, record.text);
    if (result.decision === record.label) correct += 1;
    return {
      text: record.text,
      expected: record.label,
      predicted: result.decision,
    };
  });

  return {
    total: records.length,
    correct,
    accuracy: records.length ? correct / records.length : 0,
    "error-rate": records.length ? 1 - correct / records.length : 1,
    rows,
  };
}
