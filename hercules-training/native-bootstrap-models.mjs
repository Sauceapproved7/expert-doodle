const WORD = /[a-z0-9]+/g;

export function tokenizeBootstrapText(text) {
  return String(text ?? "").toLowerCase().match(WORD) ?? [];
}

export function trainBootstrapClassifier(examples, {alpha = 1, format = "hercules-bootstrap-classifier/0.1"} = {}) {
  if (!Array.isArray(examples) || examples.length === 0) {
    throw new TypeError("examples are required");
  }
  if (!(alpha > 0)) throw new TypeError("alpha must be positive");

  const normalized = examples.map((example) => ({
    label: String(example?.label ?? "").trim(),
    text: String(example?.text ?? "").trim(),
  }));
  if (normalized.some((example) => !example.label || !example.text)) {
    throw new TypeError("every classifier example requires label and text");
  }

  const labels = [...new Set(normalized.map((example) => example.label))].sort();
  if (labels.length < 2) throw new TypeError("at least two labels are required");

  const docsPerLabel = Object.fromEntries(labels.map((label) => [label, 0]));
  const tokenCounts = Object.fromEntries(labels.map((label) => [label, {}]));
  const tokenTotals = Object.fromEntries(labels.map((label) => [label, 0]));
  const vocabulary = new Set();

  for (const example of normalized) {
    docsPerLabel[example.label] += 1;
    for (const token of tokenizeBootstrapText(example.text)) {
      vocabulary.add(token);
      tokenCounts[example.label][token] = (tokenCounts[example.label][token] ?? 0) + 1;
      tokenTotals[example.label] += 1;
    }
  }

  return {
    format,
    algorithm: "multinomial-naive-bayes",
    alpha,
    labels,
    vocabulary: [...vocabulary].sort(),
    docs: normalized.length,
    docsPerLabel,
    tokenTotals,
    tokenCounts,
  };
}

export function scoreBootstrapClassifier(model, text) {
  const tokens = tokenizeBootstrapText(text);
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

export function predictBootstrapClassifier(model, text) {
  return Object.entries(scoreBootstrapClassifier(model, text))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

export function evaluateBootstrapClassifier(model, examples) {
  if (!Array.isArray(examples) || examples.length === 0) {
    throw new TypeError("evaluation examples are required");
  }
  let correct = 0;
  const rows = examples.map((example) => {
    const expected = String(example.label);
    const predicted = predictBootstrapClassifier(model, example.text);
    if (predicted === expected) correct += 1;
    return {text: String(example.text), expected, predicted};
  });
  return {
    total: rows.length,
    correct,
    accuracy: correct / rows.length,
    rows,
  };
}

function termFrequency(tokens) {
  const counts = {};
  for (const token of tokens) counts[token] = (counts[token] ?? 0) + 1;
  return counts;
}

function vectorizeCounts(counts, idf) {
  const weights = {};
  let normSquared = 0;
  for (const [token, count] of Object.entries(counts)) {
    if (idf[token] == null) continue;
    const weight = (1 + Math.log(count)) * idf[token];
    weights[token] = weight;
    normSquared += weight * weight;
  }
  return {weights, norm: Math.sqrt(normSquared)};
}

export function trainBootstrapRetriever(documents) {
  if (!Array.isArray(documents) || documents.length < 2) {
    throw new TypeError("at least two retrieval documents are required");
  }

  const ids = new Set();
  const normalized = documents.map((document) => {
    const id = String(document?.id ?? "").trim();
    const text = String(document?.text ?? "").trim();
    if (!id || !text) throw new TypeError("every retrieval document requires id and text");
    if (ids.has(id)) throw new Error("duplicate retrieval document id: " + id);
    ids.add(id);
    return {id, text};
  });

  const documentFrequency = {};
  const countsByDocument = normalized.map((document) => {
    const counts = termFrequency(tokenizeBootstrapText(document.text));
    for (const token of Object.keys(counts)) {
      documentFrequency[token] = (documentFrequency[token] ?? 0) + 1;
    }
    return {id: document.id, counts};
  });

  const idf = {};
  for (const token of Object.keys(documentFrequency).sort()) {
    idf[token] = Math.log((1 + normalized.length) / (1 + documentFrequency[token])) + 1;
  }

  const vectors = countsByDocument.map(({id, counts}) => {
    const vector = vectorizeCounts(counts, idf);
    return {id, weights: vector.weights, norm: vector.norm};
  });

  return {
    format: "hercules-bootstrap-tfidf/0.1",
    algorithm: "tf-idf-cosine",
    documentCount: normalized.length,
    idf,
    vectors,
  };
}

export function rankBootstrapRetriever(model, query, {limit = 5} = {}) {
  const queryVector = vectorizeCounts(termFrequency(tokenizeBootstrapText(query)), model.idf);
  const results = model.vectors.map((document) => {
    let dot = 0;
    for (const [token, weight] of Object.entries(queryVector.weights)) {
      dot += weight * (document.weights[token] ?? 0);
    }
    const denominator = queryVector.norm * document.norm;
    const score = denominator > 0 ? dot / denominator : 0;
    return {id: document.id, score};
  });

  return results
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, limit));
}

export function evaluateBootstrapRetriever(model, examples) {
  if (!Array.isArray(examples) || examples.length === 0) {
    throw new TypeError("retrieval evaluation examples are required");
  }
  let correct = 0;
  const rows = examples.map((example) => {
    const predicted = rankBootstrapRetriever(model, example.query, {limit: 1})[0]?.id ?? null;
    const expected = String(example.expectedId);
    if (predicted === expected) correct += 1;
    return {query: String(example.query), expected, predicted};
  });
  return {
    total: rows.length,
    correct,
    accuracy: correct / rows.length,
    rows,
  };
}
