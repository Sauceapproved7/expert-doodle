# Hercules Global Infrastructure Benchmark

As of: 2026-09-22 UTC

## Executive result

**Global infrastructure maturity: 78/100 (77.54 exact) — strong production-engineering foundation with verified self-hosted staging.**

The isolated Hercules staging plane now has executed CI evidence rather than static-only benchmark code. GitHub Actions run `35714874182` completed successfully with staging-boundary validation, synthetic database verification, guarded load testing, backup/restore verification, a 15-minute loopback-only soak, post-soak database verification, artifact publication, and benchmark recalculation.

This score measures verified infrastructure maturity, not company size, market share, legal readiness, or launch readiness. Staging evidence improves infrastructure confidence but is not production-scale or multi-region operating history.

## Scorecard

| Domain | Weight | Score | Weighted result |
|---|---:|---:|---:|
| Software supply chain and release integrity | 15% | 92 | 13.80 |
| Platform control plane and deployment | 15% | 87 | 13.05 |
| Recovery and continuity | 12% | 83 | 9.96 |
| Observability and SRE | 12% | 68 | 8.16 |
| Scalability and performance | 12% | 55 | 6.60 |
| AI, browser, and sandbox execution | 10% | 82 | 8.20 |
| Identity, tenant, and data security | 8% | 80 | 6.40 |
| Operational automation | 6% | 82 | 4.92 |
| Compliance and independent assurance | 5% | 45 | 2.25 |
| Developer delivery experience | 5% | 84 | 4.20 |
| **Total** | **100%** |  | **77.54 → 78** |

## Executed staging evidence

### Workflow

- GitHub Actions workflow: `Hercules Global Staging Benchmark`
- Run: `35714874182`
- Conclusion: `success`
- Head SHA: `8ed5dc7a13ee57ac55ddd060f0e130b5d80877c8`
- DeepSource secret scan: passed
- Evidence artifact: `staging-performance-35714874182-1`
- Artifact digest: `sha256:981e781ac14b31d3af1b044c06066f3c3a365f31fac0f90fdf90a2eec1b77711`

### Isolation and database boundary checks

The executed staging validator passed all configured boundary checks:

- loopback ports
- internal network
- synthetic-only data
- RLS enabled
- owner policies
- fail-closed migrations
- database health
- recovery support

### Load profile

- Requests: 200
- Errors: 0
- Error rate: 0%
- Throughput: 552.55 req/s
- p50: 7.98 ms
- p95: 20.50 ms
- p99: 151.12 ms
- Result: pass

### 15-minute soak profile

- Duration: 900,001 ms
- Requests: 2,010,084
- Passed: 2,010,084
- Errors: 0
- Error rate: 0%
- Throughput: 2,233.42 req/s
- p50: 2.38 ms
- p95: 4.28 ms
- p99: 6.93 ms
- Maximum latency: 49.73 ms
- Result: pass

After sustained load, synthetic identity, synthetic record, and database health verification all passed again.

## Global standing

| Comparison tier | Hercules position |
|---|---|
| Typical prototype / no-code deployment | Clearly ahead |
| Serious early-stage SaaS platform | Ahead in release integrity and recovery; competitive overall |
| Mature cloud-native software company | Competitive architecture, still behind in operating history and global-scale evidence |
| Regulated enterprise platform | Strong technical foundation, below threshold without independent assurance and formal control evidence |
| Hyperscaler / global PaaS | Below in global scale, regional redundancy, capacity depth, SRE history, and independent operating proof |

## Evidence gaps blocking an 85+ score

- No production-representative sustained load benchmark; current performance evidence is intentionally fixture-only and loopback-only.
- No 24-hour or multi-day soak with error-budget accounting.
- No repeated full service failover under measured RTO/RPO.
- No active-active or automated active-passive regional traffic strategy.
- No long-duration SLO attainment record.
- No mature game-day history across provider outage, regional loss, credential compromise, queue backlog, and corrupt-artifact scenarios.
- No independent penetration test or external control attestation.
- Supabase Auth leaked-password protection remains unverified where owner-management access is unavailable.
- Legacy/advisor residue still requires complete documented disposition.

## Agentic platform capability update

Agentic capability coverage remains **92.5% (37/40)** under the existing rubric:

| Category | Current coverage |
|---|---:|
| Builder | 87.5% |
| Agent autonomy | 90% |
| Integration and delivery | 83.3% |
| Governance and integrity | 100% |
| Resilience and operations | 100% |

Capability coverage is not the same measure as infrastructure maturity.

## Evidence base

- GitHub Actions run `35714874182`
- Artifact `staging-performance-35714874182-1`
- `.github/workflows/hercules-global-staging-benchmark.yml`
- `.github/workflows/hercules-staging-recovery-drill.yml`
- `scripts/performance-harness.mjs`
- `scripts/recalculate-global-infrastructure.mjs`
- `staging-plane/`
- `docs/HERCULES-SELF-HOSTED-STAGING-PLANE.md`
