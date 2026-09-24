function pairKey(left, right) {
  return left + "," + right;
}

function comparePairKeys(a, b) {
  const [al, ar] = a.split(",").map(Number);
  const [bl, br] = b.split(",").map(Number);
  return al - bl || ar - br;
}

function replacePair(sequence, left, right, replacement) {
  const output = [];
  for (let i = 0; i < sequence.length; i += 1) {
    if (i + 1 < sequence.length && sequence[i] === left && sequence[i + 1] === right) {
      output.push(replacement);
      i += 1;
    } else {
      output.push(sequence[i]);
    }
  }
  return output;
}

export function trainBytePairTokenizer(texts, {
  merges = 128,
  minPairCount = 2,
} = {}) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new TypeError("tokenizer training texts are required");
  }
  if (!Number.isInteger(merges) || merges < 0 || merges > 4096) {
    throw new TypeError("merges must be an integer from 0 to 4096");
  }
  if (!Number.isInteger(minPairCount) || minPairCount < 2) {
    throw new TypeError("minPairCount must be an integer >= 2");
  }

  let sequences = texts.map((text) => [...Buffer.from(String(text), "utf8")]);
  const learned = [];

  for (let step = 0; step < merges; step += 1) {
    const counts = new Map();

    for (const sequence of sequences) {
      for (let i = 0; i + 1 < sequence.length; i += 1) {
        const key = pairKey(sequence[i], sequence[i + 1]);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const ranked = [...counts.entries()]
      .filter(([, count]) => count >= minPairCount)
      .sort((a, b) => b[1] - a[1] || comparePairKeys(a[0], b[0]));

    if (ranked.length === 0) break;

    const [key, count] = ranked[0];
    const [left, right] = key.split(",").map(Number);
    const id = 256 + learned.length;

    learned.push({id, left, right, count});
    sequences = sequences.map((sequence) =>
      replacePair(sequence, left, right, id)
    );
  }

  return {
    format: "hercules-byte-bpe/0.1",
    baseVocabularySize: 256,
    vocabularySize: 256 + learned.length,
    merges: learned,
  };
}

export function encodeWithTokenizer(tokenizer, text) {
  let sequence = [...Buffer.from(String(text), "utf8")];
  for (const merge of tokenizer.merges ?? []) {
    sequence = replacePair(sequence, merge.left, merge.right, merge.id);
  }
  return sequence;
}

function expansionMap(tokenizer) {
  return new Map((tokenizer.merges ?? []).map((merge) => [
    merge.id,
    [merge.left, merge.right],
  ]));
}

export function decodeWithTokenizer(tokenizer, tokenIds) {
  if (!Array.isArray(tokenIds)) throw new TypeError("tokenIds must be an array");
  const expansions = expansionMap(tokenizer);
  const bytes = [];

  function expand(id) {
    if (id >= 0 && id < 256) {
      bytes.push(id);
      return;
    }
    const pair = expansions.get(id);
    if (!pair) throw new Error("unknown tokenizer token id: " + id);
    expand(pair[0]);
    expand(pair[1]);
  }

  for (const id of tokenIds) expand(id);
  return Buffer.from(bytes).toString("utf8");
}

export function tokenizerRoundTrip(tokenizer, text) {
  return decodeWithTokenizer(tokenizer, encodeWithTokenizer(tokenizer, text));
}
