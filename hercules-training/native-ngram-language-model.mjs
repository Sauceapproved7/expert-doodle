function contextKey(tokens) {
  return tokens.join(",");
}

function increment(map, key, amount = 1) {
  map[key] = (map[key] ?? 0) + amount;
}

function createLevel() {
  return {contexts: {}, totals: {}};
}

export function trainNgramLanguageModel(tokenSequences, {
  order = 4,
  alpha = 0.25,
  vocabularySize,
} = {}) {
  if (!Array.isArray(tokenSequences) || tokenSequences.length === 0) {
    throw new TypeError("token sequences are required");
  }
  if (!Number.isInteger(order) || order < 1 || order > 8) {
    throw new TypeError("order must be an integer from 1 to 8");
  }
  if (!(alpha > 0)) throw new TypeError("alpha must be positive");
  if (!Number.isInteger(vocabularySize) || vocabularySize < 1) {
    throw new TypeError("vocabularySize must be a positive integer");
  }

  const bosId = vocabularySize;
  const eosId = vocabularySize + 1;
  const totalVocabularySize = vocabularySize + 2;
  const levels = Array.from({length: order}, createLevel);

  for (const raw of tokenSequences) {
    const sequence = raw.map(Number);
    const history = Array(order - 1).fill(bosId);
    const stream = [...sequence, eosId];

    for (const next of stream) {
      for (let length = 0; length < order; length += 1) {
        const context = length === 0 ? [] : history.slice(-length);
        const key = contextKey(context);
        const level = levels[length];
        if (!level.contexts[key]) level.contexts[key] = {};
        increment(level.contexts[key], String(next));
        increment(level.totals, key);
      }
      history.push(next);
      if (history.length > order - 1) history.shift();
    }
  }

  return {
    format: "hercules-ngram-lm/0.1",
    order,
    alpha,
    vocabularySize,
    totalVocabularySize,
    bosId,
    eosId,
    levels,
  };
}

function chooseLevel(model, history) {
  for (let length = model.order - 1; length >= 0; length -= 1) {
    const context = length === 0 ? [] : history.slice(-length);
    const key = contextKey(context);
    const level = model.levels[length];
    if ((level.totals[key] ?? 0) > 0) {
      return {length, key, level};
    }
  }
  return {length: 0, key: "", level: model.levels[0]};
}

export function tokenProbability(model, history, tokenId) {
  const {key, level} = chooseLevel(model, history);
  const counts = level.contexts[key] ?? {};
  const total = level.totals[key] ?? 0;
  const count = counts[String(tokenId)] ?? 0;
  return (count + model.alpha) /
    (total + model.alpha * model.totalVocabularySize);
}

export function predictNextToken(model, history, {
  allowEos = true,
} = {}) {
  const {key, level} = chooseLevel(model, history);
  const counts = level.contexts[key] ?? {};

  let best = null;
  for (let tokenId = 0; tokenId < model.totalVocabularySize; tokenId += 1) {
    if (tokenId === model.bosId) continue;
    if (!allowEos && tokenId === model.eosId) continue;
    const count = counts[String(tokenId)] ?? 0;
    const probability = tokenProbability(model, history, tokenId);
    const candidate = {tokenId, count, probability};
    if (
      best == null ||
      candidate.probability > best.probability ||
      (candidate.probability === best.probability && candidate.tokenId < best.tokenId)
    ) {
      best = candidate;
    }
  }
  return best;
}

export function evaluateNgramLanguageModel(model, tokenSequences) {
  let tokens = 0;
  let correct = 0;
  let negativeLogLikelihood = 0;

  for (const sequence of tokenSequences) {
    const history = Array(model.order - 1).fill(model.bosId);
    for (const next of [...sequence, model.eosId]) {
      const prediction = predictNextToken(model, history);
      if (prediction.tokenId === next) correct += 1;

      const probability = tokenProbability(model, history, next);
      negativeLogLikelihood += -Math.log(Math.max(probability, Number.MIN_VALUE));
      tokens += 1;

      history.push(next);
      if (history.length > model.order - 1) history.shift();
    }
  }

  const crossEntropy = tokens ? negativeLogLikelihood / tokens : Infinity;
  return {
    tokens,
    correct,
    nextTokenAccuracy: tokens ? correct / tokens : 0,
    crossEntropy,
    perplexity: Math.exp(crossEntropy),
  };
}

export function generateTokenIds(model, promptTokens, {
  maxNewTokens = 64,
} = {}) {
  if (!Number.isInteger(maxNewTokens) || maxNewTokens < 1 || maxNewTokens > 4096) {
    throw new TypeError("maxNewTokens must be an integer from 1 to 4096");
  }

  const history = [
    ...Array(model.order - 1).fill(model.bosId),
    ...promptTokens,
  ].slice(-(model.order - 1));

  const generated = [];
  for (let i = 0; i < maxNewTokens; i += 1) {
    const prediction = predictNextToken(model, history);
    if (prediction.tokenId === model.eosId) break;
    generated.push(prediction.tokenId);
    history.push(prediction.tokenId);
    if (history.length > model.order - 1) history.shift();
  }
  return generated;
}
