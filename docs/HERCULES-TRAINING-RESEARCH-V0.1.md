# Hercules Training: Research v0.1

Hercules Research v0.1 is a from-scratch native research-strategy classifier.

It selects one of five evidence strategies:

- `primary` — favor official, original, filing, standard, paper, statute, or canonical documentation
- `current` — prioritize fresh, time-bounded reporting and current official updates
- `compare` — gather matched evidence across alternatives using the same criteria
- `verify` — fact-check a concrete claim against authoritative evidence
- `background` — establish historical and conceptual context

The model is repository-owned JavaScript using multinomial Naive Bayes. It has no third-party model weights or ML SDK dependency.

Training data:
- `hercules-training/bootstrap/research-strategy-train.jsonl`
- `hercules-training/bootstrap/research-strategy-eval.jsonl`

Reproducible build:

    HERCULES_SOURCE_COMMIT=$(git rev-parse HEAD) \
      node hercules-training/bootstrap-research.mjs

Activation requires held-out accuracy >= 0.90 and error rate <= 0.10. Promotion into the model plane occurs only after the canonical `main` training artifact is verified.
