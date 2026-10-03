# Hercules SmokeScreen Sentinel v2.1.0

**Release class:** Public Community Preview  
**License:** Apache-2.0  
**Security posture:** Defensive-only

Hercules SmokeScreen Sentinel is an adaptive deception and containment subsystem for infrastructure you own or are authorized to defend.

## What it does

- scores bounded security telemetry;
- keeps ordinary traffic on the real path;
- applies a False-Positive Governor before non-honeytoken deception;
- creates synthetic-only Mirage environments for high-confidence hostile sessions;
- rotates synthetic routes and honeytokens;
- requires no-egress isolation for Mirage;
- fails closed to DENY when isolation cannot be proven;
- preserves a tamper-evident audit chain;
- produces signed, review-required defensive learning recommendations;
- never grants outbound counterattack authority.

## What this preview is not

This is not a hack-back product. It does not scan, exploit, modify, impair, or deploy code to attacker-owned devices or networks.

The current Forge ingress integration is observe-only. Live enforcement should not be enabled without the documented containment, rollback, and production evidence gates.

## Benchmark

The current evidence-based global-readiness coverage score is **64/100**.

The separate labeled synthetic fixture passed with 6/6 hostile detections, 0/6 benign/ambiguous deception diversions, 0 safety violations, and approximately 0.05 ms p95 policy-decision latency across 3,000 verified CI decisions.

Those synthetic results are not a 100/100 global-market score and are not production detection-rate evidence.

See:

- `benchmarks/HERCULES-SMOKESCREEN-GLOBAL-BENCHMARK-2026-09-28.md`
- `scripts/smokescreen-global-benchmark.mjs`

## Canonical source

Runtime:

- `hercules-runtime/smokescreen-agent.mjs`
- `hercules-runtime/smokescreen-forge-ingress.mjs`

Tests:

- `tests/hercules-smokescreen-agent.test.mjs`
- `tests/hercules-smokescreen-forge-ingress.test.mjs`
- `tests/hercules-smokescreen-global-benchmark.test.mjs`
- `tests/hercules-smokescreen-release-package.test.mjs`

## Verification

Run:

```sh
node --test tests/hercules-smokescreen-agent.test.mjs
node --test tests/hercules-smokescreen-forge-ingress.test.mjs
node --test tests/hercules-smokescreen-global-benchmark.test.mjs
node --test tests/hercules-smokescreen-release-package.test.mjs
node scripts/security-baseline.mjs
node scripts/verify-owner-code-only.mjs
```

The CI package also contains a SHA-256 manifest tied to the exact source commit.

## Install

See `INSTALL.md`.

## Security boundary

See `SECURITY.md`.

## Release notes

See `RELEASE-NOTES.md`.
