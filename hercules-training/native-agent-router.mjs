const WORD = /[a-z0-9]+/g;

export function tokenize(text) {
  return String(text ?? "").toLowerCase().match(WORD) ?? [];
}

export function trainAgentRouter(examples, {alpha = 1} = {}) {
  if (!Array.isArray(examples) || examples.length === 0) {
    throw new TypeError("examples are required");
  }
  if (!(alpha > 0)) throw new TypeError("alpha must be positive");

  const labels = [...new Set(examples.map((x) => String(x.label)))].sort();
  const docsPerLabel = Object.fromEntries(labels.map((label) => [label, 0]));
  const tokenCounts = Object.fromEntries(labels.map((label) => [label, {}]));
  const tokenTotals = Object.fromEntries(labels.map((label) => [label, 0]));
  const vocab = new Set();

  for (const example of examples) {
    const label = String(example.label);
    if (!labels.includes(label)) throw new Error("unknown label");
    docsPerLabel[label] += 1;
    for (const token of tokenize(example.text)) {
      vocab.add(token);
      tokenCounts[label][token] = (tokenCounts[label][token] ?? 0) + 1;
      tokenTotals[label] += 1;
    }
  }

  return {
    format: "hercules-agent-router-naive-bayes/0.1",
    algorithm: "multinomial-naive-bayes",
    alpha,
    labels,
    vocabulary: [...vocab].sort(),
    docs: examples.length,
    docsPerLabel,
    tokenTotals,
    tokenCounts,
  };
}

export function scoreAgentRouter(model, text) {
  const tokens = tokenize(text);
  const vocabSize = Math.max(1, model.vocabulary.length);
  const scores = {};

  for (const label of model.labels) {
    let score = Math.log(model.docsPerLabel[label] / model.docs);
    const denom = model.tokenTotals[label] + model.alpha * vocabSize;
    for (const token of tokens) {
      const count = model.tokenCounts[label][token] ?? 0;
      score += Math.log((count + model.alpha) / denom);
    }
    scores[label] = score;
  }
  return scores;
}

export function predictAgentRouter(model, text) {
  const scores = scoreAgentRouter(model, text);
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

export function evaluateAgentRouter(model, examples) {
  let correct = 0;
  const rows = examples.map((example) => {
    const predicted = predictAgentRouter(model, example.text);
    if (predicted === example.label) correct += 1;
    return {text: example.text, expected: example.label, predicted};
  });
  return {
    total: examples.length,
    correct,
    accuracy: examples.length ? correct / examples.length : 0,
    rows,
  };
}
