# Hercules Language Foundation v0.2

## Purpose

Hercules Language Foundation v0.2 is the first native **generative language substrate** in the Hercules model program.

It does not replace the active Core v0.1 control classifier and it is not represented as a frontier LLM.

It adds:

- an owner-code trainable tokenizer,
- a deterministic trigram/bigram/unigram backoff next-token model,
- held-out next-token evaluation,
- deterministic text generation,
- an immutable Core v0.2 candidate checkpoint.

## Ownership boundary

The tokenizer, language model, corpus, trainer, evaluator, tests, and evidence format are repository-owned Hercules code/data.

No third-party model weights, external language corpus, tokenizer package, or ML SDK is packaged.

## Candidate gate

The held-out candidate must satisfy:

- Top-1 next-token accuracy >= 0.35
- Cross-entropy ratio versus unigram baseline <= 0.85
- Token coverage >= 0.80

Passing these gates makes the checkpoint a **candidate**, not the active Core model.

## Reproducible build

    HERCULES_SOURCE_COMMIT=$(git rev-parse HEAD) \
      node hercules-training/bootstrap-language-foundation.mjs

Outputs:

- `.hercules-training/language-foundation-v0.2/checkpoint.json`
- `.hercules-training/language-foundation-v0.2/training-evidence.json`

## Next capability step

After the candidate is stable, Hercules can replace the count-based next-token baseline with a larger trainable neural architecture while preserving the tokenizer, dataset provenance, checkpoint hashing, evaluation, and promotion contracts.
