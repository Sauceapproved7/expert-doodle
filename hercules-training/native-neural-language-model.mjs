import {
  SPECIAL_TOKENS,
  decode,
  encode,
} from "./native-tokenizer.mjs";

function seededRandom(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function zeros(length) {
  return Array.from({length}, () => 0);
}

function randomVector(length, random, scale) {
  return Array.from({length}, () => (random() * 2 - 1) * scale);
}

function softmax(logits, masked = new Set()) {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i += 1) {
    if (masked.has(i)) continue;
    if (logits[i] > max) max = logits[i];
  }

  const probabilities = zeros(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i += 1) {
    if (masked.has(i)) continue;
    const value = Math.exp(logits[i] - max);
    probabilities[i] = value;
    sum += value;
  }

  if (!(sum > 0)) throw new Error("softmax normalization failed");
  for (let i = 0; i < probabilities.length; i += 1) {
    probabilities[i] /= sum;
  }
  return probabilities;
}

function argmax(values, masked = new Set()) {
  let best = -1;
  let bestValue = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    if (masked.has(i)) continue;
    if (values[i] > bestValue) {
      best = i;
      bestValue = values[i];
    }
  }
  return best;
}

function buildExamples(tokenizer, texts, contextLength) {
  const bos = tokenizer.tokenToId[SPECIAL_TOKENS.BOS];
  const examples = [];

  for (const text of texts) {
    const ids = encode(tokenizer, text, {eos: true});
    const context = Array.from({length: contextLength}, () => bos);

    for (const target of ids) {
      examples.push({context: [...context], target});
      context.shift();
      context.push(target);
    }
  }

  return examples;
}

function shuffleInPlace(array, random) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function flattenContext(model, contextIds) {
  const result = [];
  for (const tokenId of contextIds) {
    const row = model.embeddings[tokenId];
    if (!row) throw new Error("context token outside embedding matrix");
    result.push(...row);
  }
  return result;
}

function logitsFor(model, contextIds) {
  const input = flattenContext(model, contextIds);
  return model.outputWeights.map((row, tokenId) => {
    let value = model.outputBias[tokenId];
    for (let i = 0; i < input.length; i += 1) value += row[i] * input[i];
    return value;
  });
}

function maskedIds(tokenizer) {
  return new Set([
    tokenizer.tokenToId[SPECIAL_TOKENS.PAD],
    tokenizer.tokenToId[SPECIAL_TOKENS.BOS],
  ]);
}

export function trainNeuralNextTokenModel(tokenizer, texts, {
  contextLength = 2,
  embeddingDim = 12,
  epochs = 36,
  learningRate = 0.08,
  seed = 37,
  initScale = 0.04,
} = {}) {
  if (!tokenizer?.vocabulary?.length) throw new TypeError("tokenizer is required");
  if (!Array.isArray(texts) || texts.length === 0) throw new TypeError("training texts are required");
  if (!Number.isInteger(contextLength) || contextLength < 1 || contextLength > 8) {
    throw new TypeError("contextLength must be an integer from 1 to 8");
  }
  if (!Number.isInteger(embeddingDim) || embeddingDim < 2 || embeddingDim > 128) {
    throw new TypeError("embeddingDim must be an integer from 2 to 128");
  }
  if (!Number.isInteger(epochs) || epochs < 1 || epochs > 500) {
    throw new TypeError("epochs must be an integer from 1 to 500");
  }
  if (!(learningRate > 0 && learningRate <= 1)) throw new TypeError("learningRate must be in (0, 1]");

  const random = seededRandom(seed);
  const vocabularySize = tokenizer.vocabulary.length;
  const inputSize = contextLength * embeddingDim;
  const model = {
    format: "hercules-native-neural-language/0.3",
    algorithm: "context-embedding-softmax-sgd",
    contextLength,
    embeddingDim,
    vocabularySize,
    seed,
    epochs,
    learningRate,
    embeddings: Array.from(
      {length: vocabularySize},
      () => randomVector(embeddingDim, random, initScale),
    ),
    outputWeights: Array.from(
      {length: vocabularySize},
      () => randomVector(inputSize, random, initScale),
    ),
    outputBias: zeros(vocabularySize),
    unigramCounts: zeros(vocabularySize),
    trainingExamples: 0,
  };

  const examples = buildExamples(tokenizer, texts, contextLength);
  model.trainingExamples = examples.length;
  for (const example of examples) model.unigramCounts[example.target] += 1;

  const masked = maskedIds(tokenizer);
  const order = Array.from({length: examples.length}, (_, index) => index);

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    shuffleInPlace(order, random);
    const rate = learningRate / Math.sqrt(1 + epoch * 0.18);

    for (const index of order) {
      const example = examples[index];
      const input = flattenContext(model, example.context);
      const logits = logitsFor(model, example.context);
      const probabilities = softmax(logits, masked);

      const delta = [...probabilities];
      delta[example.target] -= 1;

      const inputGradient = zeros(input.length);
      for (let tokenId = 0; tokenId < vocabularySize; tokenId += 1) {
        if (masked.has(tokenId)) continue;
        const d = Math.max(-1, Math.min(1, delta[tokenId]));
        const row = model.outputWeights[tokenId];

        for (let j = 0; j < input.length; j += 1) {
          inputGradient[j] += d * row[j];
        }
      }

      for (let tokenId = 0; tokenId < vocabularySize; tokenId += 1) {
        if (masked.has(tokenId)) continue;
        const d = Math.max(-1, Math.min(1, delta[tokenId]));
        const row = model.outputWeights[tokenId];

        for (let j = 0; j < input.length; j += 1) {
          row[j] -= rate * d * input[j];
        }
        model.outputBias[tokenId] -= rate * d;
      }

      for (let position = 0; position < contextLength; position += 1) {
        const tokenId = example.context[position];
        const row = model.embeddings[tokenId];
        const offset = position * embeddingDim;

        for (let dim = 0; dim < embeddingDim; dim += 1) {
          const gradient = Math.max(-1, Math.min(1, inputGradient[offset + dim]));
          row[dim] -= rate * gradient;
        }
      }
    }
  }

  return model;
}

export function neuralNextTokenDistribution(tokenizer, model, contextIds) {
  const bos = tokenizer.tokenToId[SPECIAL_TOKENS.BOS];
  const normalized = Array.from(
    {length: model.contextLength},
    (_, index) => contextIds[contextIds.length - model.contextLength + index] ?? bos,
  );
  const logits = logitsFor(model, normalized);
  const probabilities = softmax(logits, maskedIds(tokenizer));
  return probabilities
    .map((probability, tokenId) => ({tokenId, probability}))
    .sort((a, b) => b.probability - a.probability || a.tokenId - b.tokenId);
}

export function predictNeuralNextToken(tokenizer, model, contextIds) {
  const distribution = neuralNextTokenDistribution(tokenizer, model, contextIds);
  return distribution[0] ?? {tokenId: null, probability: 0};
}

export function generateNeuralText(tokenizer, model, prompt, {maxTokens = 48} = {}) {
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 512) {
    throw new TypeError("maxTokens must be an integer from 1 to 512");
  }

  const bos = tokenizer.tokenToId[SPECIAL_TOKENS.BOS];
  const eos = tokenizer.tokenToId[SPECIAL_TOKENS.EOS];
  const context = Array.from({length: model.contextLength}, () => bos);
  for (const id of encode(tokenizer, prompt)) {
    context.shift();
    context.push(id);
  }

  const generated = [];
  for (let i = 0; i < maxTokens; i += 1) {
    const prediction = predictNeuralNextToken(tokenizer, model, context);
    if (prediction.tokenId == null || prediction.tokenId === eos) break;
    generated.push(prediction.tokenId);
    context.shift();
    context.push(prediction.tokenId);
  }

  return {
    prompt,
    continuation: decode(tokenizer, generated),
    tokenIds: generated,
  };
}

export function evaluateNeuralNextTokenModel(tokenizer, model, texts) {
  const bos = tokenizer.tokenToId[SPECIAL_TOKENS.BOS];
  const eos = tokenizer.tokenToId[SPECIAL_TOKENS.EOS];
  const unigramTotal = model.unigramCounts.reduce((sum, value) => sum + value, 0);
  let total = 0;
  let correct = 0;
  let nonWhitespaceTotal = 0;
  let nonWhitespaceCorrect = 0;
  let nll = 0;
  let unigramNll = 0;

  for (const text of texts) {
    const context = Array.from({length: model.contextLength}, () => bos);
    const ids = encode(tokenizer, text, {eos: true});

    for (const target of ids) {
      const distribution = neuralNextTokenDistribution(tokenizer, model, context);
      const predicted = distribution[0]?.tokenId ?? null;
      const probability = Math.max(
        distribution.find((item) => item.tokenId === target)?.probability ?? 1e-12,
        1e-12,
      );
      const unigramProbability = Math.max(
        (model.unigramCounts[target] + 0.1) /
          (unigramTotal + 0.1 * model.vocabularySize),
        1e-12,
      );

      if (predicted === target) correct += 1;
      total += 1;
      nll += -Math.log(probability);
      unigramNll += -Math.log(unigramProbability);

      const token = tokenizer.vocabulary[target] ?? "";
      const contentToken =
        target !== eos &&
        !/^\s+$/.test(token) &&
        !Object.values(SPECIAL_TOKENS).includes(token);

      if (contentToken) {
        nonWhitespaceTotal += 1;
        if (predicted === target) nonWhitespaceCorrect += 1;
      }

      context.shift();
      context.push(target);
    }
  }

  const crossEntropy = total ? nll / total : 0;
  const unigramCrossEntropy = total ? unigramNll / total : 0;

  return {
    total,
    correct,
    top1Accuracy: total ? correct / total : 0,
    nonWhitespaceTotal,
    nonWhitespaceCorrect,
    nonWhitespaceTop1Accuracy:
      nonWhitespaceTotal ? nonWhitespaceCorrect / nonWhitespaceTotal : 0,
    crossEntropy,
    perplexity: Math.exp(crossEntropy),
    unigramCrossEntropy,
    unigramPerplexity: Math.exp(unigramCrossEntropy),
    crossEntropyRatio:
      unigramCrossEntropy ? crossEntropy / unigramCrossEntropy : 1,
  };
}
