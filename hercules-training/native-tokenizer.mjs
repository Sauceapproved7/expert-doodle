const TOKEN_RE = /[A-Za-z0-9]+|[^\sA-Za-z0-9]|\s+/g;

export const SPECIAL_TOKENS = Object.freeze({
  PAD: "<PAD>",
  BOS: "<BOS>",
  EOS: "<EOS>",
  UNK: "<UNK>",
});

export function segmentText(text) {
  return String(text ?? "").match(TOKEN_RE) ?? [];
}

export function trainTokenizer(texts, {maxVocabulary = 2048, minFrequency = 1} = {}) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new TypeError("tokenizer training texts are required");
  }
  if (!Number.isInteger(maxVocabulary) || maxVocabulary < 8) {
    throw new TypeError("maxVocabulary must be an integer >= 8");
  }
  if (!Number.isInteger(minFrequency) || minFrequency < 1) {
    throw new TypeError("minFrequency must be >= 1");
  }

  const counts = new Map();
  for (const text of texts) {
    for (const token of segmentText(text)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  const specials = Object.values(SPECIAL_TOKENS);
  const learned = [...counts.entries()]
    .filter(([, count]) => count >= minFrequency)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, maxVocabulary - specials.length))
    .map(([token]) => token);

  const vocabulary = [...specials, ...learned.filter((token) => !specials.includes(token))];
  const tokenToId = Object.fromEntries(vocabulary.map((token, index) => [token, index]));

  return {
    format: "hercules-native-tokenizer/0.2",
    vocabulary,
    tokenToId,
    maxVocabulary,
    minFrequency,
    trainingTexts: texts.length,
  };
}

export function encode(tokenizer, text, {bos = false, eos = false} = {}) {
  const ids = [];
  if (bos) ids.push(tokenizer.tokenToId[SPECIAL_TOKENS.BOS]);

  for (const token of segmentText(text)) {
    ids.push(tokenizer.tokenToId[token] ?? tokenizer.tokenToId[SPECIAL_TOKENS.UNK]);
  }

  if (eos) ids.push(tokenizer.tokenToId[SPECIAL_TOKENS.EOS]);
  return ids;
}

export function decode(tokenizer, ids, {skipSpecial = true} = {}) {
  const specials = new Set(Object.values(SPECIAL_TOKENS));
  return ids.map((id) => {
    const token = tokenizer.vocabulary[id] ?? SPECIAL_TOKENS.UNK;
    if (skipSpecial && specials.has(token)) return "";
    return token;
  }).join("");
}

export function tokenizerCoverage(tokenizer, texts) {
  let total = 0;
  let unknown = 0;
  const unk = tokenizer.tokenToId[SPECIAL_TOKENS.UNK];

  for (const text of texts) {
    for (const id of encode(tokenizer, text)) {
      total += 1;
      if (id === unk) unknown += 1;
    }
  }

  return {
    totalTokens: total,
    unknownTokens: unknown,
    coverage: total === 0 ? 1 : 1 - unknown / total,
  };
}
