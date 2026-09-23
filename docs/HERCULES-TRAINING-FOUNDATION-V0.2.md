# Hercules Training Foundation v0.2

## Purpose

Hercules Training Foundation turns the Model Plane into an auditable, reproducible model-building system.

The Model Plane defines model identity, lifecycle, routing, and runtime bindings. The Training Foundation defines how data is admitted, how jobs are declared, how workers execute training, how checkpoints are fingerprinted, how evaluation evidence is recorded, and what must pass before any model can be considered for activation.

## Evidence chain

Every production-eligible checkpoint must trace through:

    dataset manifest
      -> training job
      -> training worker
      -> checkpoint SHA-256
      -> evaluation suite
      -> evaluation evidence
      -> activation decision
      -> model-plane runtime binding

Dataset admission fails closed unless the source, content hash, record count, license or rights basis, explicit training permission, provenance origin, and source commit are recorded.

Training jobs bind exact dataset fingerprints, a deterministic seed, source commit, trainer identity, entrypoint, and hyperparameters.

Checkpoint records bind model identity to the exact training-job fingerprint and serialized artifact hash.

Evaluation results bind a checkpoint to an immutable suite fingerprint and evidence hash.

Activation checks use the canonical Hercules model catalog rather than accepting a caller-supplied model definition.

## First real Hercules-native checkpoint

v0.2 includes the first checkpoint actually trained for Hercules:

**Hercules Agent Router bootstrap v0.1**

- canonical family: `hercules-agent`
- role: narrow request-routing micro-model
- algorithm: multinomial naive Bayes
- implementation: repository-owned JavaScript
- external pretrained weights: none
- external training corpus: none
- training examples: 48
- held-out bootstrap examples: 16
- routing labels: agent, code, general, research, retrieval, safety, vision, voice
- checkpoint format: inspectable JSON
- checkpoint bytes: 7,410
- checkpoint SHA-256: `b8a2973aad22a9425b4143d008b1f9e1920ec0a3cb1e3585b03c2220216b0e4b`
- bootstrap evaluation: 16/16 correct

The training examples and evaluation examples are project-authored bootstrap material. No third-party model weights or third-party corpus were imported for this checkpoint.

The perfect bootstrap score is intentionally narrow evidence only. Sixteen project-authored examples do not establish broad reasoning, robustness, generalization, or frontier-model capability.

For that reason, the canonical `hercules-agent` slot remains `planned`. The checkpoint is a verified training milestone, not a production activation.

## Reproducibility

Run:

    node hercules-training/bootstrap-agent-router.mjs

The reproduction command:

1. validates the dataset manifest
2. verifies the exact training-data SHA-256
3. validates the immutable job declaration
4. retrains the model from the committed data
5. serializes the checkpoint deterministically
6. verifies byte count and SHA-256 against the recorded checkpoint
7. reruns the held-out evaluation
8. verifies the evaluation evidence hash
9. applies the bootstrap evaluation threshold
10. writes local reproduction evidence under `.hercules-training/`

CI performs the same reproduction and refuses to auto-activate the bootstrap model.

## Training worker boundary

The general training control plane supports a replaceable worker protocol:

    hercules-training-worker/0.1

A worker receives an immutable job declaration plus admitted dataset manifests and returns checkpoint metadata. The worker executes training only. It does not control canonical model identity, provenance policy, evaluation thresholds, or activation policy.

The built-in HTTP runner rejects redirects, bounds response size, and supports bearer authentication without credentials embedded in URLs.

## Control service

Run:

    HERCULES_TRAINING_TOKEN=<secret> node hercules-training/control-cli.mjs

Optional worker binding:

    HERCULES_TRAINING_RUNNER_URL=http://127.0.0.1:38920/train
    HERCULES_TRAINING_RUNNER_TOKEN=<secret>

The control service binds to `127.0.0.1:38910` by default.

API surface:

- GET /health
- GET /v1/datasets
- GET /v1/jobs
- GET /v1/checkpoints
- GET /v1/evaluations
- POST /v1/datasets
- POST /v1/jobs
- POST /v1/jobs/:jobId/run
- POST /v1/checkpoints
- POST /v1/suites
- POST /v1/evaluations
- POST /v1/activations/check

Mutating and evidence-reading routes require the control token.

## Next model-building increments

The remaining work now shifts from control-plane plumbing toward actual model capability:

1. corpus normalization, deduplication, contamination checks, and quality scoring
2. Hercules tokenizer training and versioning
3. accelerator-backed training worker with deterministic job capture
4. native embedding and reranking checkpoints
5. small Hercules language-model pretraining experiments
6. broader held-out, adversarial, and regression evaluation suites
7. quantization and inference resource admission
8. vision, voice, code, guard, research, and core training pipelines

Every later family must inherit the same provenance, reproducibility, checkpoint, and evaluation rules.
