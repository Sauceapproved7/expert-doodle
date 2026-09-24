import {SPECIAL_TOKENS, encode, decode} from "./native-tokenizer.mjs";

function increment(map, key, tokenId) {
  const bucket = map[key] ?? {};
  bucket[tokenId] = (bucket[tokenId] ?? 0) + 1;
  map[key] = bucket;
}

function normalizeBucket(bucket) {
  const total = Object.values(bucket ?? {}).reduce((sum, value) => sum + value, 0);
  if (!total) return [];
  return Object.entries(bucket)
    .map(([tokenId, count]) => ({tokenId: Number(tokenId), count, probability: count / total}))
    .sort((a, b) => b.count - a.count || a.tokenId - b.tokenId);
}

export function trainNextTokenModel(tokenizer, texts) {
  if (!tokenizer?.vocabulary?.length) throw new TypeError("tokenizer is required");
  if (!Array.isArray(texts) || texts.length === 0) throw new TypeError("training texts are required");

  const unigram = {};
  const bigram = {};
  const trigram = {};
  let tokenCount = 0;

  for (const text of texts) {
    const ids = encode(tokenizer, text, {bos: true, eos: true});
    for (let i = 0; i < ids.length; i += 1) {
      const current = ids[i];
      unigram[current] = (unigram[current] ?? 0) + 1;
      tokenCount += 1;

      if (i >= 1) increment(bigram, String(ids[i - 1]), current);
      if (i >= 2) increment(trigram, ids[i - 2] + "," + ids[i - 1], current);
    }
  }

  return {
    format: "hercules-native-backoff-language/0.2",
    algorithm: "trigram-bigram-unigram-backoff",
    vocabularySize: tokenizer.vocabulary.length,
    tokenCount,
    unigram,
    bigram,
    trigram,
  };
}

export function nextTokenDistribution(model, contextIds) {
  const last = contextIds.at(-1);
  const prior = contextIds.at(-2);

  if (prior != null && last != null) {
    const tri = normalizeBucket(model.trigram[prior + "," + last]);
    if (tri.length) return {order: 3, items: tri};
  }

  if (last != null) {
    const bi = normalizeBucket(model.bigram[String(last)]);
    if (bi.length) return {order: 2, items: bi};
  }

  return {order: 1, items: normalizeBucket(model.unigram)};
}

export function predictNextToken(model, contextIds) {
  const distribution = nextTokenDistribution(model, contextIds);
  return {
    order: distribution.order,
    tokenId: distribution.items[0]?.tokenId ?? null,
    probability: distribution.items[0]?.probability ?? 0,
  };
}

export function generateText(tokenizer, model, prompt, {maxTokens = 48} = {}) {
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 512) {
    throw new TypeError("maxTokens must be an integer from 1 to 512");
  }

  const bos = tokenizer.tokenToId[SPECIAL_TOKENS.BOS];
  const eos = tokenizer.tokenToId[SPECIAL_TOKENS.EOS];
  const promptIds = encode(tokenizer, prompt);
  const context = [bos, ...promptIds];
  const generated = [];

  for (let i = 0; i < maxTokens; i += 1) {
    const predicted = predictNextToken(model, context);
    if (predicted.tokenId == null || predicted.tokenId === eos) break;
    generated.push(predicted.tokenId);
    context.push(predicted.tokenId);
  }

  return {
    prompt,
    continuation: decode(tokenizer, generated),
    tokenIds: generated,
  };
}

function tokenProbability(model, contextIds, actualId) {
  const distribution = nextTokenDistribution(model, contextIds);
  const item = distribution.items.find((entry) => entry.tokenId === actualId);
  if (item) return Math.max(item.probability, 1e-12);

  const uni = normalizeBucket(model.unigram);
  const fallback = uni.find((entry) => entry.tokenId === actualId);
  return Math.max((fallback?.probability ?? 1 / Math.max(1, model.vocabularySize)) * 0.05, 1e-12);
}

export function evaluateNextTokenModel(tokenizer, model, texts) {
  const bos = tokenizer.tokenToId[SPECIAL_TOKENS.BOS];
  let correct = 0;
  let total = 0;
  let negativeLogLikelihood = 0;
  let unigramNegativeLogLikelihood = 0;
  const unigramDistribution = normalizeBucket(model.unigram);
  const unigramMap = new Map(unigramDistribution.map((item) => [item.tokenId, item.probability]));

  for (const text of texts) {
    const ids = encode(tokenizer, text, {eos: true});
    const context = [bos];

    for (const actualId of ids) {
      const predicted = predictNextToken(model, context);
      if (predicted.tokenId === actualId) correct += 1;

      const probability = tokenProbability(model, context, actualId);
      negativeLogLikelihood += -Math.log(probability);

      const baseline = Math.max(
        (unigramMap.get(actualId) ?? 1 / Math.max(1, model.vocabularySize)) * 0.999,
        1e-12,
      );
      unigramNegativeLogLikelihood += -Math.log(baseline);

      total += 1;
      context.push(actualId);
    }
  }

  const crossEntropy = total ? negativeLogLikelihood / total : 0;
  const unigramCrossEntropy = total ? unigramNegativeLogLikelihood / total : 0;

  return {
    total,
    correct,
    top1Accuracy: total ? correct / total : 0,
    crossEntropy,
    perplexity: Math.exp(crossEntropy),
    unigramCrossEntropy,
    unigramPerplexity: Math.exp(unigramCrossEntropy),
    crossEntropyRatio: unigramCrossEntropy ? crossEntropy / unigramCrossEntropy : 1,
  };
}
