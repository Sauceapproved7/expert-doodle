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

function softmax(logits) {
  const max = Math.max(...logits);
  const values = logits.map((value) => Math.exp(value - max));
  const sum = values.reduce((a, b) => a + b, 0);
  return values.map((value) => value / sum);
}

function shuffleInPlace(array, random) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function decodePixelSample(sample) {
  const width = Number(sample?.width);
  const height = Number(sample?.height);
  const pixels = String(sample?.pixels ?? "");

  if (!Number.isInteger(width) || width < 1 || width > 128) {
    throw new TypeError("pixel sample width must be an integer from 1 to 128");
  }
  if (!Number.isInteger(height) || height < 1 || height > 128) {
    throw new TypeError("pixel sample height must be an integer from 1 to 128");
  }
  if (pixels.length !== width * height || /[^01]/.test(pixels)) {
    throw new TypeError("pixel sample must contain exactly width*height binary pixels");
  }

  return {
    label: sample?.label == null ? null : String(sample.label),
    width,
    height,
    vector: [...pixels].map((value) => value === "1" ? 1 : 0),
  };
}

function forward(model, vector) {
  if (vector.length !== model.inputSize) {
    throw new TypeError("pixel vector size does not match model input");
  }

  const hiddenPre = model.hiddenWeights.map((row, index) => {
    let value = model.hiddenBias[index];
    for (let i = 0; i < vector.length; i += 1) value += row[i] * vector[i];
    return value;
  });
  const hidden = hiddenPre.map((value) => Math.max(0, value));

  const logits = model.outputWeights.map((row, index) => {
    let value = model.outputBias[index];
    for (let i = 0; i < hidden.length; i += 1) value += row[i] * hidden[i];
    return value;
  });

  return {hiddenPre, hidden, logits, probabilities: softmax(logits)};
}

export function trainVisionPixelClassifier(samples, {
  hiddenDim = 12,
  epochs = 48,
  learningRate = 0.04,
  seed = 59,
  initScale = 0.08,
} = {}) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new TypeError("vision training samples are required");
  }
  if (!Number.isInteger(hiddenDim) || hiddenDim < 2 || hiddenDim > 128) {
    throw new TypeError("hiddenDim must be an integer from 2 to 128");
  }
  if (!Number.isInteger(epochs) || epochs < 1 || epochs > 500) {
    throw new TypeError("epochs must be an integer from 1 to 500");
  }
  if (!(learningRate > 0 && learningRate <= 1)) {
    throw new TypeError("learningRate must be in (0, 1]");
  }

  const decoded = samples.map(decodePixelSample);
  const width = decoded[0].width;
  const height = decoded[0].height;
  const inputSize = width * height;

  for (const sample of decoded) {
    if (!sample.label) throw new TypeError("training samples require labels");
    if (sample.width !== width || sample.height !== height) {
      throw new Error("all vision samples must share one raster size");
    }
  }

  const labels = [...new Set(decoded.map((sample) => sample.label))].sort();
  const labelToId = Object.fromEntries(labels.map((label, index) => [label, index]));
  const random = seededRandom(seed);

  const model = {
    format: "hercules-native-vision-pixel/0.2",
    algorithm: "pixel-mlp-softmax-sgd",
    width,
    height,
    inputSize,
    hiddenDim,
    labels,
    seed,
    epochs,
    learningRate,
    trainingSamples: decoded.length,
    hiddenWeights: Array.from(
      {length: hiddenDim},
      () => randomVector(inputSize, random, initScale),
    ),
    hiddenBias: zeros(hiddenDim),
    outputWeights: Array.from(
      {length: labels.length},
      () => randomVector(hiddenDim, random, initScale),
    ),
    outputBias: zeros(labels.length),
  };

  const order = Array.from({length: decoded.length}, (_, index) => index);

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    shuffleInPlace(order, random);
    const rate = learningRate / Math.sqrt(1 + epoch * 0.12);

    for (const index of order) {
      const sample = decoded[index];
      const target = labelToId[sample.label];
      const {hiddenPre, hidden, probabilities} = forward(model, sample.vector);

      const outputDelta = [...probabilities];
      outputDelta[target] -= 1;

      const hiddenGradient = zeros(hiddenDim);
      for (let labelId = 0; labelId < labels.length; labelId += 1) {
        const delta = Math.max(-1, Math.min(1, outputDelta[labelId]));
        const row = model.outputWeights[labelId];
        for (let h = 0; h < hiddenDim; h += 1) {
          hiddenGradient[h] += delta * row[h];
        }
      }

      for (let labelId = 0; labelId < labels.length; labelId += 1) {
        const delta = Math.max(-1, Math.min(1, outputDelta[labelId]));
        const row = model.outputWeights[labelId];
        for (let h = 0; h < hiddenDim; h += 1) {
          row[h] -= rate * delta * hidden[h];
        }
        model.outputBias[labelId] -= rate * delta;
      }

      for (let h = 0; h < hiddenDim; h += 1) {
        if (hiddenPre[h] <= 0) continue;
        const gradient = Math.max(-1, Math.min(1, hiddenGradient[h]));
        const row = model.hiddenWeights[h];
        for (let i = 0; i < inputSize; i += 1) {
          row[i] -= rate * gradient * sample.vector[i];
        }
        model.hiddenBias[h] -= rate * gradient;
      }
    }
  }

  return model;
}

export function classifyVisionPixels(model, sample) {
  const decoded = decodePixelSample(sample);
  if (decoded.width !== model.width || decoded.height !== model.height) {
    throw new TypeError("pixel sample dimensions do not match model");
  }

  const {probabilities} = forward(model, decoded.vector);
  let best = 0;
  for (let i = 1; i < probabilities.length; i += 1) {
    if (probabilities[i] > probabilities[best]) best = i;
  }

  return {
    label: model.labels[best],
    confidence: probabilities[best],
    probabilities: Object.fromEntries(
      model.labels.map((label, index) => [label, probabilities[index]]),
    ),
  };
}

export function evaluateVisionPixelClassifier(model, samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new TypeError("vision evaluation samples are required");
  }

  const totals = Object.fromEntries(model.labels.map((label) => [label, 0]));
  const correctByLabel = Object.fromEntries(model.labels.map((label) => [label, 0]));
  let correct = 0;
  const rows = [];

  for (const sample of samples) {
    const decoded = decodePixelSample(sample);
    if (!decoded.label || !(decoded.label in totals)) {
      throw new Error("evaluation sample has unknown label");
    }

    const prediction = classifyVisionPixels(model, sample);
    totals[decoded.label] += 1;
    if (prediction.label === decoded.label) {
      correct += 1;
      correctByLabel[decoded.label] += 1;
    }
    rows.push({
      expected: decoded.label,
      predicted: prediction.label,
      confidence: prediction.confidence,
      variant: sample.variant ?? null,
      noiseFlips: sample.noiseFlips ?? null,
    });
  }

  const perClassRecall = Object.fromEntries(
    model.labels.map((label) => [
      label,
      totals[label] ? correctByLabel[label] / totals[label] : 0,
    ]),
  );
  const accuracy = correct / samples.length;
  const minClassRecall = Math.min(...Object.values(perClassRecall));

  return {
    total: samples.length,
    correct,
    accuracy,
    minClassRecall,
    baselineImprovement: accuracy - 1 / model.labels.length,
    perClassRecall,
    rows,
  };
}
