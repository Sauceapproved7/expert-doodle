# Hercules Model Plane v0.1

## Purpose

Hercules Model Plane is the SauceApproved-owned control layer for native Hercules model identity, lifecycle state, routing, runtime binding, checkpoint evidence, and inference.

It remains separate from Hercules Forge. Forge owns application specifications, compilation, artifacts, releases, and deployment policy. The Model Plane owns model selection and execution but cannot bypass Forge validation or release controls.

## Eight active native model families

The canonical v0.1 catalog contains eight Hercules-native active models:

- **hercules-core** — general-response mode routing
- **hercules-coder** — software-work routing
- **hercules-vision** — visual-request routing
- **hercules-voice** — voice-request routing
- **hercules-research** — research-strategy routing
- **hercules-agent** — agent intent routing
- **hercules-retrieval** — sparse embeddings and reranking
- **hercules-guard** — action-policy classification

Every active entry has:

- a deterministic native checkpoint
- an immutable SHA-256 identity
- original Hercules-authored training/evaluation material
- a held-out evaluation gate
- a permanent repository attestation
- an embedded runtime that reconstructs the checkpoint and refuses startup on hash mismatch

Production routing remains native-only by default.

## v0.1 capability boundary

The word **active** means the declared v0.1 capability is trained, attested, routeable, and executable. It does not mean each family is already a frontier-scale foundation model.

Core, Coder, and Research v0.1 are compact control classifiers.

Vision v0.1 routes visual-analysis requests but does not itself inspect image pixels.

Voice v0.1 routes speech/audio requests but does not itself perform speech recognition or audio synthesis.

Agent, Retrieval, and Guard provide the specialized native capabilities documented by their individual training and activation artifacts.

Later versions can replace these v0.1 checkpoints with broader native models without changing the Model Plane contract.

## Model lifecycle

A model moves through:

    planned -> development -> candidate -> active -> retired

Only `active` models are eligible for production routing.

An active model must have a routeable runtime and matching attestation evidence. Model-plane CI fails closed if an active model lacks an approved checkpoint, runtime, or attestation.

## Owned service

Run:

    HERCULES_MODEL_TOKEN=<secret> node hercules-models/control-cli.mjs

Defaults:

    host: 127.0.0.1
    port: 38900
    native-only routing: true

Routes:

- GET /health
- GET /v1/models
- POST /v1/route
- POST /v1/infer

Inventory, routing, and inference require the bearer control token. Health intentionally exposes only non-secret service state.

## Training and provenance

Training control records:

1. dataset source and training rights
2. dataset content hashes
3. exact source commit
4. deterministic training job configuration
5. checkpoint SHA-256 and size
6. held-out evaluation suite and metrics
7. activation decision
8. permanent repository attestation

Hercules v0.1 native checkpoints use repository-owned JavaScript and Hercules-authored bootstrap corpora. Third-party operating systems, runtimes, CI infrastructure, or other underlying tools retain their own rights and do not become Hercules-owned components.

## Long-term direction

The Model Plane contract is intentionally stable while model capability grows. Future versions can add larger generative Core/Coder/Research models, pixel-native Vision, and real ASR/TTS Voice checkpoints while preserving the same provenance, evaluation, activation, routing, and runtime boundaries.
