# Hercules Video v0.1

## Ownership boundary

Hercules Video is an original SauceApproved orchestration layer. Its core routing, shot policy, quality scoring, provenance manifest, retry decisions, and provider abstraction live in this repository.

External video models are **rendering backends**, not the product brain. No provider is canonical. A provider may be removed or replaced without changing the Hercules Video project contract.

## v0.1 responsibilities

Hercules owns:

1. Creative brief normalization.
2. Shot requirements and constraints.
3. Provider capability matching.
4. Quality/cost-aware routing.
5. Deterministic run manifests and fingerprints.
6. Render quality scoring and winner selection.
7. Fail-closed behavior when no provider satisfies a shot.
8. Provenance policy.
9. A stable adapter boundary for future engines.

Provider adapters own only:

- health,
- cost estimation,
- generation,
- asset inspection/metadata retrieval.

## Quality dimensions

The initial scorer measures:

- prompt adherence,
- temporal consistency,
- visual quality,
- brand consistency,
- audio quality,
- artifact freedom,
- reliability.

The weighting is Hercules-owned and versioned in `hercules-video/core.mjs`.

## Vendor independence

The core does not import Google, Runway, ByteDance, MiniMax, or any other video provider SDK. Provider-specific code must live behind an adapter and may not leak provider-specific request shapes into the canonical Hercules project manifest.

## Provenance rule

Generated runs should retain:

- project/brief fingerprint,
- shot prompt and constraints,
- selected provider adapter ID,
- generation request fingerprint,
- output asset checksum when available,
- quality evaluation,
- any rejected/alternate render evidence.

This lets Hercules prove what it asked for, what generated it, and why a final render was selected.

## Next build increments

- Hercules-owned storyboard compiler.
- Persistent provider registry.
- Concrete adapter implementations.
- Automated render inspection.
- multi-engine render tournament,
- scene continuity memory,
- assembly/audio/caption pipeline,
- branded launch-video preset.
