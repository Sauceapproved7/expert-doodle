const WORD = /[a-z0-9]+/g;

export function tokenizeFamilyText(text) {
  return String(text ?? "").toLowerCase().match(WORD) ?? [];
}

export function trainFamilyClassifier(examples, {alpha = 1, format = "hercules-family-classifier/0.1"} = {}) {
  if (!Array.isArray(examples) || examples.length === 0) throw new TypeError("examples are required");
  if (!(alpha > 0)) throw new TypeError("alpha must be positive");

  const rows = examples.map((x) => ({
    label: String(x?.label ?? "").trim(),
    text: String(x?.text ?? "").trim(),
  }));
  if (rows.some((x) => !x.label || !x.text)) throw new TypeError("each example requires label and text");

  const labels = [...new Set(rows.map((x) => x.label))].sort();
  if (labels.length < 2) throw new TypeError("at least two labels are required");

  const docsPerLabel = Object.fromEntries(labels.map((label) => [label, 0]));
  const tokenCounts = Object.fromEntries(labels.map((label) => [label, {}]));
  const tokenTotals = Object.fromEntries(labels.map((label) => [label, 0]));
  const vocabulary = new Set();

  for (const row of rows) {
    docsPerLabel[row.label] += 1;
    for (const token of tokenizeFamilyText(row.text)) {
      vocabulary.add(token);
      tokenCounts[row.label][token] = (tokenCounts[row.label][token] ?? 0) + 1;
      tokenTotals[row.label] += 1;
    }
  }

  return {
    format,
    algorithm: "multinomial-naive-bayes",
    alpha,
    labels,
    vocabulary: [...vocabulary].sort(),
    docs: rows.length,
    docsPerLabel,
    tokenTotals,
    tokenCounts,
  };
}

export function scoreFamilyClassifier(model, text) {
  const tokens = tokenizeFamilyText(text);
  const vocabSize = Math.max(1, model.vocabulary.length);
  const scores = {};
  for (const label of model.labels) {
    let score = Math.log(model.docsPerLabel[label] / model.docs);
    const denominator = model.tokenTotals[label] + model.alpha * vocabSize;
    for (const token of tokens) {
      const count = model.tokenCounts[label][token] ?? 0;
      score += Math.log((count + model.alpha) / denominator);
    }
    scores[label] = score;
  }
  return scores;
}

export function predictFamilyClassifier(model, text) {
  return Object.entries(scoreFamilyClassifier(model, text))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

export function evaluateFamilyClassifier(model, examples) {
  if (!Array.isArray(examples) || examples.length === 0) throw new TypeError("evaluation examples are required");
  let correct = 0;
  const rows = examples.map((example) => {
    const expected = String(example.label);
    const predicted = predictFamilyClassifier(model, example.text);
    if (predicted === expected) correct += 1;
    return {text: String(example.text), expected, predicted};
  });
  return {
    total: rows.length,
    correct,
    accuracy: correct / rows.length,
    errorRate: 1 - (correct / rows.length),
    rows,
  };
}
