# Hercules Video v1.5 — read-only run status

## Purpose

v1.5 adds a read-only operator status surface over the canonical v1.4 persistent launch state. It does not submit renders, evaluate media, assemble video, mutate launch state, delete files, or alter final/evidence outputs.

## Command

```sh
node hercules-video/run-status-cli.mjs --state /absolute/path/to/launch-state.json
```

The command emits machine-readable JSON and exits non-zero when state or artifact integrity cannot be verified.

## Report

The report includes the sealed state fingerprint, launch stage, execution-plan/upstream/checkpoint/runtime/runner identity, ordered per-shot state, verified reusable completed shots, shots requiring resubmission, stored evaluation coverage, finalization closure, final output/evidence identities, and any blocking integrity error.

A completed render is marked safely reusable only when the entire persisted state validates and the existing v1.4 artifact/evaluation verification succeeds. Any integrity failure clears the reusable set and keeps finalization open.

## Trust boundary

The command is intentionally observational. It reads the launch-state file and referenced local completed artifacts only. It performs no network requests and has no credential, provider, render, evaluation, assembly, deployment, trading, or profit-claim behavior.

The status module reuses the canonical v1.4 validation and artifact/evaluation binding checks rather than creating a weaker parallel trust path.

## Provenance

The implementation, tests, CLI, and documentation are Hercules-owned repository code. No external model weights, provider SDKs, datasets, or copied third-party implementation are introduced.
