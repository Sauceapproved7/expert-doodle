# Hercules Eight-Family Native Bootstrap v0.3

## Status

Hercules now has an evidence-backed native checkpoint path across all eight canonical model families.

- **Production-active canonical model:** 1 — `hercules-agent`
- **Attested native bootstrap candidates:** 7 — Core, Coder, Vision, Voice, Research, Retrieval, Guard
- **Families with at least one Hercules-native checkpoint:** 8 of 8
- **Flagship family models that are fully production-capable:** 1 of 8

The distinction is intentional. A bootstrap checkpoint is a real trained model artifact with deterministic code, owned training/evaluation material, a SHA-256 checkpoint identity, held-out evaluation, and an embedded runtime. It is not automatically equivalent to the long-term flagship capability described by the canonical family slot.

## Active model

`hercules-agent` remains the only production-active canonical model. Its native intent-routing checkpoint is permanently attested and available through the embedded Agent Router runtime.

## Seven candidate baselines

The seven additional native baselines are held at `candidate` state:

| Family | Bootstrap capability | Algorithm | Held-out bootstrap result |
| --- | --- | --- | --- |
| Core | instruction-mode routing | multinomial Naive Bayes | 100% |
| Coder | software-work intent routing | multinomial Naive Bayes | 100% |
| Vision | visual-request intent routing | multinomial Naive Bayes | 100% |
| Voice | voice-request intent routing | multinomial Naive Bayes | 100% |
| Research | research-strategy routing | multinomial Naive Bayes | 100% |
| Retrieval | lexical document ranking | TF-IDF cosine | 100% |
| Guard | action-risk routing | multinomial Naive Bayes | 100% |

These percentages apply only to the small Hercules-authored held-out bootstrap suites committed for these narrow capabilities. They are not claims about broad real-world benchmark performance.

## Capability boundary

The bootstrap Vision model does **not** inspect pixels. The bootstrap Voice model does **not** perform ASR or TTS. Core, Coder, and Research are control/routing classifiers rather than generative foundation models. Guard assists risk routing but never replaces deterministic authorization. Retrieval is a functional lexical retriever, not a neural embedding model.

The canonical flagship slots remain planned until their actual target capabilities have training data, compute, evaluation suites, runtime evidence, and activation approval.

## Evidence

Permanent attestation:

`hercules-models/attestations/hercules-family-bootstrap-v0.1.json`

Training source:

`hercules-training/bootstrap/family-bootstrap.json`

Training implementation:

- `hercules-training/native-bootstrap-models.mjs`
- `hercules-training/bootstrap-family-models.mjs`

Candidate catalog and embedded runtime:

- `hercules-models/bootstrap-catalog.mjs`
- `hercules-models/embedded-family-bootstrap.mjs`

CI artifact:

- workflow run: `35922479308`
- artifact: `10777647124`
- artifact digest: `sha256:2a7abff60643ca05513a2b1f94af5d2c8357b8100bc80804c42f07219aa83d41`

## Promotion rule

A candidate may not replace its canonical planned slot merely because this bootstrap gate passes. Promotion requires a capability-matched evaluation suite and a runtime that actually performs the canonical task. This keeps Hercules from confusing “a native checkpoint exists” with “the full model is finished.”
