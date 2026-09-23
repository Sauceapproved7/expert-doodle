const WORD = /[a-z0-9]+/g;

const STOP = new Set([
  "a","an","and","are","as","at","be","before","by","can","does","for","from",
  "how","in","into","is","it","of","on","or","the","this","to","what","when",
  "where","which","will","with"
]);

function normalizeWord(token) {
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

export function features(text) {
  const words = (String(text).toLowerCase().match(WORD) ?? [])
    .map(normalizeWord)
    .filter((token) => token.length > 1 && !STOP.has(token));

  const result = [];
  for (const word of words) {
    result.push("w:" + word);
    if (word.length >= 4) {
      const padded = "^" + word + "$";
      for (let i = 0; i <= padded.length - 3; i++) {
        result.push("c:" + padded.slice(i, i + 3));
      }
    }
  }
  return result;
}

export function trainNativeRetriever(documents) {
  if (!Array.isArray(documents) || documents.length < 2) {
    throw new TypeError("at least two documents are required");
  }

  const documentFrequency = Object.create(null);
  const seenIds = new Set();

  for (const document of documents) {
    const id = String(document?.id ?? "");
    if (!id) throw new TypeError("document id is required");
    if (seenIds.has(id)) throw new Error("duplicate document id: " + id);
    seenIds.add(id);

    const unique = new Set(features(document.text));
    for (const feature of unique) {
      documentFrequency[feature] = (documentFrequency[feature] ?? 0) + 1;
    }
  }

  const idf = Object.create(null);
  const count = documents.length;
  for (const [feature, df] of Object.entries(documentFrequency)) {
    idf[feature] = Math.log((count + 1) / (df + 1)) + 1;
  }

  return {
    format: "hercules-native-sparse-retrieval/0.1",
    algorithm: "tfidf-word-char3-cosine",
    documentCount: count,
    idf,
  };
}

export function embedText(model, text) {
  const counts = Object.create(null);
  for (const feature of features(text)) {
    if (model.idf[feature] == null) continue;
    counts[feature] = (counts[feature] ?? 0) + 1;
  }

  const weighted = Object.create(null);
  let norm2 = 0;
  for (const [feature, count] of Object.entries(counts)) {
    const tf = 1 + Math.log(count);
    const value = tf * model.idf[feature];
    weighted[feature] = value;
    norm2 += value * value;
  }

  const norm = Math.sqrt(norm2);
  if (norm === 0) return {};

  const vector = {};
  for (const feature of Object.keys(weighted).sort()) {
    vector[feature] = weighted[feature] / norm;
  }
  return vector;
}

export function cosineSparse(left, right) {
  const [small, large] = Object.keys(left).length <= Object.keys(right).length
    ? [left, right]
    : [right, left];

  let score = 0;
  for (const [feature, value] of Object.entries(small)) {
    if (large[feature] != null) score += value * large[feature];
  }
  return score;
}

export function rerankDocuments(model, query, documents) {
  const queryVector = embedText(model, query);
  return documents
    .map((document) => ({
      id: document.id,
      score: cosineSparse(queryVector, embedText(model, document.text)),
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function evaluateRetriever(model, documents, cases) {
  const byId = new Map(documents.map((document) => [document.id, document]));
  let top1 = 0;
  let reciprocalRank = 0;
  const rows = [];

  for (const item of cases) {
    const candidates = item.candidateIds.map((id) => {
      const document = byId.get(id);
      if (!document) throw new Error("unknown candidate document: " + id);
      return document;
    });

    const ranking = rerankDocuments(model, item.query, candidates);
    const rank = ranking.findIndex((row) => row.id === item.relevantId) + 1;
    if (rank === 1) top1 += 1;
    if (rank > 0) reciprocalRank += 1 / rank;

    rows.push({
      query: item.query,
      relevantId: item.relevantId,
      rank,
      ranking,
    });
  }

  return {
    total: cases.length,
    top1: top1 / cases.length,
    mrr: reciprocalRank / cases.length,
    rows,
  };
}
