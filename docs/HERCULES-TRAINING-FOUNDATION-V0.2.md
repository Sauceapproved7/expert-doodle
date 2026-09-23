# Hercules Training Foundation v0.2

## Purpose

Hercules Training Foundation makes model creation auditable and reproducible before any checkpoint can become active.

The model plane defines what Hercules models exist and how they are routed. The training foundation defines how a Hercules-native checkpoint earns the right to occupy one of those model slots.

## Evidence chain

A production-eligible native checkpoint must trace through:

    dataset manifest
      -> training job
      -> training worker
      -> checkpoint hash
      -> evaluation suite
      -> evaluation evidence
      -> activation decision
      -> model-plane runtime binding

Every material record is fingerprinted. Dataset admission fails closed unless the source, content hash, rights basis, license, training permission, record count, and source commit are declared.

Training jobs bind the exact dataset fingerprints, seed, code commit, trainer identity, entrypoint, and hyperparameters.

Checkpoints bind the exact job fingerprint and model identity.

Evaluation results bind both the evaluation-suite fingerprint and checkpoint SHA-256.

Activation requires the canonical Hercules model identity, the required evaluation suites, passing thresholds, and a routeable runtime.

## First real Hercules-native model

v0.2 includes the first small model trained from scratch by Hercules:

**Hercules Agent Router v0.1**

It is a multinomial Naive Bayes text classifier implemented in repository-owned JavaScript with no external model weights and no machine-learning SDK dependency.

Its job is intentionally narrow: classify an instruction into one of five orchestration intents:

- code
- research
- vision
- speech
- general

Training and held-out evaluation examples are original Hercules project material committed under:

- `hercules-training/bootstrap/agent-routing-train.jsonl`
- `hercules-training/bootstrap/agent-routing-eval.jsonl`

The reproducible bootstrap command is:

    HERCULES_SOURCE_COMMIT=$(git rev-parse HEAD) \
      node hercules-training/bootstrap-agent-router.mjs

The command trains the model, evaluates it, hashes the exact serialized checkpoint, applies the activation gate, and writes:

- `.hercules-training/bootstrap-agent-router/model.json`
- `.hercules-training/bootstrap-agent-router/training-evidence.json`

The local state directory is ignored by Git.

## Control service

Run:

    HERCULES_TRAINING_TOKEN=<secret> node hercules-training/control-cli.mjs

Optional remote worker:

    HERCULES_TRAINING_RUNNER_URL=http://127.0.0.1:38920/train
    HERCULES_TRAINING_RUNNER_TOKEN=<secret>

The worker protocol is:

    hercules-training-worker/0.1

The worker executes training only. It does not control canonical model identity, dataset admission, checkpoint acceptance, evaluation requirements, or activation policy.

## API surface

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

Mutating and evidence-reading routes require the bearer control token.

## What this does not claim

The native agent router is a real trained model, but it is deliberately small and specialized. It is not a general-purpose language model and it does not make Hercules equivalent to frontier-scale LLMs.

The remaining Hercules families stay in `planned` state until real training/evaluation evidence exists for them.

## Next training increments

1. native retrieval embeddings / reranking experiments
2. tokenizer and corpus builder for language-model work
3. accelerator-backed training worker
4. checkpoint object store and signed artifact attestations
5. larger native agent model
6. coding, research, vision, voice, guard, and core model pipelines

The same evidence chain must apply to every future model family.
