# Hercules Model Plane v0.1

## Purpose

Hercules Model Plane is the SauceApproved-owned control layer for the models Hercules will train, evaluate, activate, route, and eventually serve.

It is deliberately separate from Hercules Forge. Forge owns application specifications, compilation, artifacts, releases, and deployment policy. The Model Plane owns model identity, lifecycle state, task capability, routing policy, runtime binding, and checkpoint/provenance references.

## What v0.1 implements

The canonical repository now defines eight Hercules model families:

- hercules-core — general reasoning and instruction following
- hercules-coder — software engineering and code work
- hercules-vision — images, screenshots, documents, and UI understanding
- hercules-voice — speech recognition and synthesis
- hercules-research — retrieval-aware research and evidence synthesis
- hercules-agent — tool selection and workflow control
- hercules-retrieval — embeddings and reranking
- hercules-guard — policy, permissions, secret handling, and action validation

All eight are currently marked **planned**, with no checkpoint and no runtime. That is intentional. Repository state must not claim a model exists until a real checkpoint has passed the applicable training, provenance, evaluation, and activation gates.

## Native-first policy

Production routing is native-only by default.

The schema can represent migration or evaluation sources, but the default router refuses any model whose origin does not begin with `hercules-`.

Even when that restriction is explicitly disabled for migration testing, the deterministic router ranks Hercules-controlled origins ahead of open-weight or external alternatives.

## Model lifecycle

A model moves through:

    planned -> development -> candidate -> active -> retired

Only `active` models are eligible for production routing.

An active model must have a routeable runtime. This prevents an inventory entry from being treated as an executable model.

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

Inventory and routing routes require a bearer control token. Health is intentionally non-secret and reports only service state and counts.

## Forge integration boundary

The Forge prompt-ingress layer remains provider-neutral. Once a Hercules model runtime becomes active, an interpreter service can use Model Plane routing to select the correct native model and return a Forge specification through the existing owned interpreter protocol.

The model never receives authority to bypass Forge validation, artifact verification, release control, or deployment policy.

## Training ownership path

v0.1 establishes the model-control contract before training begins.

The next training increments should add, in order:

1. dataset/provenance registry with license and source evidence
2. tokenizer and corpus build pipeline
3. reproducible training-job specification and compute runner
4. checkpoint registry with immutable hashes and lineage
5. task-specific evaluation suites and activation thresholds
6. inference runtime adapter and resource admission controls
7. distillation and specialist-model pipeline

Each checkpoint must remain traceable to the exact data declaration, training configuration, code commit, evaluation evidence, and runtime version that produced it.

## Ownership boundary

SauceApproved controls the Hercules-specific registry, lifecycle schema, routing policy, service code, training orchestration added later, evaluation policy, and activation rules committed to this repository.

Underlying operating systems, language runtimes, hardware, frameworks, libraries, datasets, or third-party weights retain their own licenses and rights. No third-party component becomes Hercules-owned merely because it is used during development.

The long-term target is that the eight production model families are backed by Hercules-native checkpoints and that external model services are optional rather than foundational.
