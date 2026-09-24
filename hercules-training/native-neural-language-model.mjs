import {SPECIAL_TOKENS, encode, decode} from "./native-tokenizer.mjs";

function createPrng(seed) {
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

function softmax(logits) {
  let max = -Infinity;
  for (const value of logits) if (value > max) max = value;

  const exp = new Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i += 1) {
    const value = Math.exp(logits[i] - max);
    exp[i] = value;
    sum += value;
  }
  for (let i = 0; i < exp.length; i += 1) exp[i] /= sum;
  return exp;
}

function buildExamples(tokenizer, texts) {
  const bos = tokenizer.tokenToId[SPECIAL_TOKENS.BOS];
  const examples = [];

  for (const text of texts) {
    const ids = encode(tokenizer, text, {eos: true});
    let previous = bos;
    for (const target of ids) {
      examples.push([previous, target]);
      previous = target;
    }
  }
  return examples;
}

function unigramCounts(tokenizer, texts) {
  const counts = zeros(tokenizer.vocabulary.length);
  let total = 0;
  for (const text of texts) {
    for (const id of encode(tokenizer, text, {eos: true})) {
      counts[id] += 1;
      total += 1;
    }
  }
  return {counts, total};
}

export function createNeuralLanguageModel(tokenizer, {
  embeddingDim = 12,
  seed = 37,
  trainingTexts = [],
} = {}) {
  if (!tokenizer?.vocabulary?.length) throw new TypeError("tokenizer is required");
  if (!Number.isInteger(embeddingDim) || embeddingDim < 2 || embeddingDim > 128) {
    throw new TypeError("embeddingDim must be an integer from 2 to 128");
  }

  const vocabSize = tokenizer.vocabulary.length;
  const random = createPrng(seed);
  const scale = 1 / Math.sqrt(embeddingDim);
  const embeddings = Array.from(
    {length: vocabSize},
    () => randomVector(embeddingDim, random, scale),
  );
  const outputWeights = Array.from(
    {length: vocabSize},
    () => randomVector(embeddingDim, random, scale),
  );

  const {counts, total} = unigramCounts(tokenizer, trainingTexts);
  const outputBias = counts.map((count) =>
    Math.log((count + 1) / (total + vocabSize))
  );

  return {
    format: "hercules-native-neural-language/0.3",
    architecture: "token-embedding-softmax-next-token",
    seed,
    embeddingDim,
    vocabularySize: vocabSize,
    embeddings,
    outputWeights,
    outputBias,
  };
}

export function logitsForContext(model, previousTokenId) {
  const hidden = model.embeddings[previousTokenId];
  if (!hidden) throw new TypeError("invalid previous token id");

  const logits = new Array(model.vocabularySize);
  for (let token = 0; token < model.vocabularySize; token += 1) {
    const weights = model.outputWeights[token];
    let value = model.outputBias[token];
    for (let k = 0; k < model.embeddingDim; k += 1) {
      value += weights[k] * hidden[k];
    }
    logits[token] = value;
  }
  return logits;
}

export function predictNeuralNextToken(model, previousTokenId) {
  const probabilities = softmax(logitsForContext(model, previousTokenId));
  let bestId = 0;
  for (let i = 1; i < probabilities.length; i += 1) {
    if (probabilities[i] > probabilities[bestId]) bestId = i;
  }
  return {
    tokenId: bestId,
    probability: probabilities[bestId],
    probabilities,
  };
}

export function trainNeuralLanguageModel(tokenizer, texts, {
  embeddingDim = 12,
  seed = 37,
  epochs = 10,
  learningRate = 0.04,
  gradientClip = 5,
} = {}) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new TypeError("training texts are required");
  }
  if (!Number.isInteger(epochs) || epochs < 1 || epochs > 200) {
    throw new TypeError("epochs must be an integer from 1 to 200");
  }
  if (!(learningRate > 0 && learningRate <= 1)) {
    throw new TypeError("learningRate must be in (0, 1]");
  }

  const model = createNeuralLanguageModel(tokenizer, {
    embeddingDim,
    seed,
    trainingTexts: texts,
  });
  const examples = buildExamples(tokenizer, texts);
  const losses = [];

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const lr = learningRate / (1 + epoch * 0.08);
    let epochLoss = 0;

    for (const [previous, target] of examples) {
      const hidden = model.embeddings[previous];
      const logits = logitsForContext(model, previous);
      const probabilities = softmax(logits);
      epochLoss += -Math.log(Math.max(probabilities[target], 1e-12));

      const gradLogits = probabilities;
      gradLogits[target] -= 1;

      const gradHidden = zeros(model.embeddingDim);
      for (let token = 0; token < model.vocabularySize; token += 1) {
        const grad = Math.max(-gradientClip, Math.min(gradientClip, gradLogits[token]));
        const weights = model.outputWeights[token];

        for (let k = 0; k < model.embeddingDim; k += 1) {
          gradHidden[k] += grad * weights[k];
        }

        for (let k = 0; k < model.embeddingDim; k += 1) {
          weights[k] -= lr * grad * hidden[k];
        }
        model.outputBias[token] -= lr * grad;
      }

      for (let k = 0; k < model.embeddingDim; k += 1) {
        const grad = Math.max(-gradientClip, Math.min(gradientClip, gradHidden[k]));
        hidden[k] -= lr * grad;
      }
    }

    losses.push(epochLoss / examples.length);
  }

  model.training = {
    epochs,
    learningRate,
    gradientClip,
    examples: examples.length,
    losses,
  };
  return model;
}

export function generateNeuralText(tokenizer, model, prompt, {maxTokens = 48} = {}) {
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 512) {
    throw new TypeError("maxTokens must be an integer from 1 to 512");
  }

  const bos = tokenizer.tokenToId[SPECIAL_TOKENS.BOS];
  const eos = tokenizer.tokenToId[SPECIAL_TOKENS.EOS];
  const promptIds = encode(tokenizer, prompt);
  let previous = promptIds.at(-1) ?? bos;
  const generated = [];

  for (let i = 0; i < maxTokens; i += 1) {
    const next = predictNeuralNextToken(model, previous).tokenId;
    if (next === eos) break;
    generated.push(next);
    previous = next;
  }

  return {
    prompt,
    continuation: decode(tokenizer, generated),
    tokenIds: generated,
  };
}

export function evaluateNeuralLanguageModel(tokenizer, model, texts, trainingTexts = []) {
  const examples = buildExamples(tokenizer, texts);
  let correct = 0;
  let nll = 0;

  const {counts, total} = unigramCounts(tokenizer, trainingTexts.length ? trainingTexts : texts);
  const denominator = total + tokenizer.vocabulary.length;

  for (const [previous, target] of examples) {
    const predicted = predictNeuralNextToken(model, previous);
    if (predicted.tokenId === target) correct += 1;
    nll += -Math.log(Math.max(predicted.probabilities[target], 1e-12));
  }

  let baselineNll = 0;
  for (const [, target] of examples) {
    const probability = (counts[target] + 1) / denominator;
    baselineNll += -Math.log(Math.max(probability, 1e-12));
  }

  const crossEntropy = examples.length ? nll / examples.length : 0;
  const unigramCrossEntropy = examples.length ? baselineNll / examples.length : 0;

  return {
    total: examples.length,
    correct,
    top1Accuracy: examples.length ? correct / examples.length : 0,
    crossEntropy,
    perplexity: Math.exp(crossEntropy),
    unigramCrossEntropy,
    unigramPerplexity: Math.exp(unigramCrossEntropy),
    crossEntropyRatio: unigramCrossEntropy ? crossEntropy / unigramCrossEntropy : 1,
  };
}
