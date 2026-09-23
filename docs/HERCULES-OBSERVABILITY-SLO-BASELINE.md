# Hercules Observability and SLO Baseline

## Purpose

This baseline turns isolated Hercules staging measurements into repeatable reliability evidence without pretending that fixture-only sampling is production operating history.

The baseline is deliberately conservative. A clean benchmark window can pass its objectives while the overall status remains `passing_insufficient_history` until enough dated samples exist.

## Scope

- Environment: isolated self-hosted staging only.
- Target class: loopback, read-only health/readiness endpoints guarded by `scripts/performance-harness.mjs`.
- Production SLO claim: **no**.
- Continuous telemetry claim: **no**.
- Measurement horizon for maturity: 30 UTC days of retained sampled evidence.

## Initial objectives

| SLI | Objective |
|---|---:|
| Good request ratio | >= 99.9% |
| p95 latency | <= 500 ms |
| p99 latency | <= 1,000 ms |

The availability error budget is therefore 0.1% of measured requests. The evaluator reports both consumed and remaining budget for the sampled windows.

## Evidence maturity gate

Hercules does not label the sampled SLO as historically attained until all of these are true:

- at least 30 distinct UTC days,
- at least 30 retained measurement windows,
- at least 27,000 seconds (7.5 hours) of sampled execution.

These requirements establish repeated sampled history. They still do **not** equal continuous production telemetry or a production SLO.

## Status meanings

- `breached`: one or more current objectives failed.
- `passing_insufficient_history`: current samples pass, but the history gate is incomplete.
- `attained_with_sampled_evidence`: current objectives pass and the sampled history gate is complete.

## Evidence chain

1. `scripts/performance-harness.mjs` produces guarded performance windows.
2. `scripts/evaluate-slo.mjs` validates the evidence boundary and calculates SLO/error-budget results.
3. `.github/workflows/hercules-slo-evidence.yml` runs the staging measurements, retrieves retained prior SLO artifacts when available, evaluates the accumulated sampled history, and uploads the new evidence bundle.
4. GitHub Actions artifacts provide dated retention without committing generated telemetry to `main`.

## Non-claims

This baseline does not establish:

- multi-region availability,
- production customer traffic behavior,
- 24x7 production telemetry,
- independent assurance,
- production incident response history.

Those remain separate benchmark evidence gates.
