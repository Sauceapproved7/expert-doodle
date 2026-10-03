# Hercules Rapid Prototype Pipeline

This module adapts useful *ideas* from the CatSDK concept into Hercules-owned code. It does not copy or import CatSDK implementation code.

## Pipeline

1. Capture a small prototype goal.
2. Prefer local-first, hardware-aware execution where practical.
3. Optimize interactive workloads against an explicit frame-rate target.
4. Keep the prototype non-production by default.
5. Require tests, security review, provenance verification, and explicit owner approval before production release.

The upstream `xai.md` describes rapid single-file prototyping, emulator starters, personalization, and local hardware optimization. Those concepts are treated only as design inspiration. Hercules keeps its existing production controls and fail-closed boundaries.

## Ownership and provenance

Implementation in this repository is original Hercules code owned under the repository's existing SauceApproved ownership/provenance policy. No upstream CatSDK source code is vendored by this adaptation.
