# Hercules Video v1.0 — Local Launch Bootstrap

## Purpose

v1.0 wires the canonical Hercules Video components into one self-hosted launch path without downloading models, hiding hardware requirements, or introducing a commercial fallback.

## Canonical path

1. Normalize absolute local paths and pinned model evidence.
2. Probe NVIDIA/CUDA hardware.
3. Enforce the Wan2.2 24 GB-class GPU policy.
4. Instantiate the pinned Wan2.2 TI2V-5B runner.
5. Require runner health.
6. Start the Hercules local video runtime.
7. Register the Hercules self-hosted render adapter.
8. Require adapter health.
9. Load the canonical Hercules launch preset.
10. Build the v0.8 self-hosted-only campaign execution plan.
11. Use the v0.9 execution service to render and await every shot.
12. Require an explicit Hercules quality evaluator.
13. Assemble through the existing FFmpeg boundary.
14. Build the campaign evidence package.
15. Export a launch evidence bundle containing final output evidence, execution/session fingerprints, model commit, checkpoint SHA-256, and hardware probe.

## No hidden setup

The bootstrap does **not**:

- download Wan2.2,
- download model weights,
- install CUDA,
- install FFmpeg,
- invent a checkpoint checksum,
- silently call a commercial video provider,
- invent quality scores,
- bypass failed health checks.

## Required host inputs

A real render host must provide:

- compatible NVIDIA/CUDA hardware,
- absolute path to a separately installed Wan2.2 checkout,
- pinned 40-character upstream commit,
- absolute checkpoint directory,
- verified checkpoint SHA-256,
- absolute render output directory,
- absolute final output path,
- absolute evidence export path,
- approved local audio tracks,
- a Hercules quality evaluator.

## Evidence

The exported launch bundle links:

- campaign execution-plan fingerprint,
- execution-session fingerprint,
- winners fingerprint,
- assembly-plan fingerprint,
- assembly-evidence fingerprint,
- campaign-evidence fingerprint,
- final output checksum,
- Wan upstream commit,
- checkpoint SHA-256,
- hardware probe.

## Remaining physical dependency

The code path is ready to execute, but an actual launch video still requires a compatible GPU host with the pinned Wan2.2 installation/checkpoint and local FFmpeg/audio assets.
