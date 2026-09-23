# Hercules Video v1.2 — Enforced Quality Gate

## Purpose

v1.2 makes the v1.1 render acceptance gate mandatory in the canonical launch bootstrap.

A raw semantic scoring callback is no longer accepted as sufficient launch-time quality evidence.

## Enforced path

**render completion → technical media acceptance → semantic evaluation → normalized Hercules quality scores → tournament scoring**

## Rules

- A directly supplied quality evaluator must be marked as a Hercules render acceptance gate.
- Unmarked raw quality evaluators are rejected.
- If no prebuilt gate is supplied, the bootstrap requires a semantic evaluator and constructs the Hercules gate itself.
- Technical probing occurs before semantic evaluation.
- Technical failure blocks tournament scoring.
- Post-audio visual renders are not penalized for lacking native audio.

## Gate identity

Evaluators created by `createHerculesRenderQualityEvaluator` carry non-enumerable gate identity metadata:

- `herculesRenderAcceptanceGate = true`
- `herculesRenderAcceptanceGateVersion = 1`

The marker prevents accidental bypass through an arbitrary scorer while keeping the evaluator function dependency-injectable.

## Ownership boundary

Hercules owns:

- the technical acceptance policy,
- the gate identity,
- the launch-time enforcement rule,
- quality normalization,
- the semantic evaluator contract.

A semantic vision/video model may be replaced without changing this policy.

## Remaining execution dependency

A real launch still requires a compatible self-hosted render host, pinned Wan2.2 checkout/checkpoint, FFmpeg, approved audio assets, and a semantic evaluator implementation.
