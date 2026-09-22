# Hercules Global Infrastructure Benchmark

As of: 2026-09-22 UTC

## Executive result

**Global infrastructure maturity: 75/100 — strong production-engineering foundation, early global-platform stage.**

Hercules is strongest where many young platforms are weakest: signed-release admission, tamper-evident evidence, least-privilege workload identity, deny-by-default runtime controls, independent-region recovery, and verified rollback. It is not yet hyperscaler-grade. The largest evidence gaps are sustained load, multi-region service failover, measured SLO history, capacity engineering, incident exercises, and independent compliance assurance.

This score measures verified infrastructure maturity, not company size, market share, legal readiness, or launch readiness.

## Scorecard

| Domain | Weight | Score | Weighted result | Evidence judgment |
|---|---:|---:|---:|---|
| Software supply chain and release integrity | 15% | 92 | 13.8 | Signed admission, digest binding, immutable flight chain, rejected unsigned release, verified rollback |
| Platform control plane and deployment | 15% | 85 | 12.8 | Brokered deploy path, deployment command center, policy-enforced release IDs, production verification |
| Recovery and continuity | 12% | 78 | 9.4 | Independent `us-west-1` recovery project, private append-only vault, digest proof; only one evidenced restore lineage |
| Observability and SRE | 12% | 66 | 7.9 | Security events, metric rollups, freshness checks, alert objectives; insufficient SLO history and incident drill evidence |
| Scalability and performance | 12% | 48 | 5.8 | Serverless primitives and bounded workloads are favorable; no credible load, stress, soak, concurrency, or capacity benchmark |
| AI, browser, and sandbox execution | 10% | 82 | 8.2 | Live provider failover, Browserless check, isolated WASI execution, health recording and fail-closed behavior |
| Identity, tenant, and data security | 8% | 76 | 6.1 | SPIFFE-form identities, short TTLs, RLS/revocation controls, server-only secrets; Auth leaked-password control remains unverified |
| Operational automation | 6% | 74 | 4.4 | Automated admission, verification, rollback path, recovery replication, and launch/technical gate; limited scheduled chaos and failover automation |
| Compliance and independent assurance | 5% | 45 | 2.3 | Strong technical evidence model, but no independent audit, certification, penetration-test report, or complete control mapping |
| Developer delivery experience | 5% | 82 | 4.1 | Natural-language build path, validation, deploy, live verification, integration hub, and operational console |
| **Total** | **100%** |  | **74.7 → 75** |  |

## Global standing

| Comparison tier | Hercules position |
|---|---|
| Typical prototype / no-code deployment | Clearly ahead |
| Serious early-stage SaaS platform | Ahead in release integrity and recovery; competitive overall |
| Mature cloud-native software company | Competitive architecture, behind in operating history and scale evidence |
| Regulated enterprise platform | Strong foundation, below threshold without independent assurance and formal control evidence |
| Hyperscaler / global PaaS | Well below in scale, regional redundancy, capacity depth, SRE staffing, and years of operational proof |

## Verified differentiators

1. **Every production mutation is release-gated.** Static publish, backend dispatch, and rollback depend on an admitted signed release.
2. **Evidence is cryptographically bound.** The production artifact digest, release passport, flight-chain head, and recovery snapshot are linked.
3. **Recovery is outside the production project and region.** Production is in `us-east-1`; the recovery vault is in a separate Supabase project in `us-west-1`.
4. **The recovery object was verified byte-for-byte.** The proof endpoint returned HTTP 200 with the exact artifact digest.
5. **Runtime permissions fail closed.** Workloads have bounded identities, explicit actions, short credential TTLs, resource ceilings, egress allowlists, and quarantine behavior.
6. **AI is not deployment authority.** AI, browser, and WebAssembly checks feed evidence; admission remains a policy decision.
7. **A bad release is demonstrably rejected.** The unsigned/nonexistent release assertion returned false while signed production and rollback evidence remained intact.

## Evidence gaps blocking an 85+ score

These are engineering maturity gaps, not launch tasks:

- No published p50/p95/p99 latency, throughput, concurrency, or saturation results.
- No 24-hour or multi-day soak test with error-budget accounting.
- Recovery proves artifact replication, but not a repeated full service failover under a measured RTO/RPO.
- No active-active or automated active-passive regional traffic strategy.
- Alert objectives exist, but there is no long-duration SLO attainment record.
- No game-day history covering provider outage, regional loss, credential compromise, queue backlog, or corrupt artifact scenarios.
- No independent penetration test or external control attestation.
- Supabase Auth leaked-password protection remains unverified because project-owner management access is unavailable.
- Existing advisor residue and legacy-table policy posture require a complete documented disposition, even where access has already been revoked.

## Highest-value next benchmark work

1. Build a reproducible load, stress, spike, and soak harness with latency, error, and saturation thresholds.
2. Run a full recovery game day that restores service, not only the release artifact, and records achieved RTO/RPO.
3. Establish four golden-signal SLOs and collect a 30-day baseline.
4. Automate dependency and region-failure exercises in a non-customer fixture environment.
5. Produce a formal control matrix mapping each technical control to its evidence record and test.
6. Commission an independent penetration test after the preceding evidence is stable.

## Agentic platform capability update

The earlier 2026-09-18 capability benchmark scored Hercules at 80% (32/40). The verified deployment broker, repository execution loop, live Browserless verification, DevBrain fabric, and cross-region recovery raise current internal capability coverage to an estimated **92.5% (37/40)** under the same rubric:

| Category | Current coverage |
|---|---:|
| Builder | 87.5% |
| Agent autonomy | 90% |
| Integration and delivery | 83.3% |
| Governance and integrity | 100% |
| Resilience and operations | 100% |

That 92.5% is capability coverage, not the infrastructure maturity score. The stricter global infrastructure score remains 75/100 because deployed features do not substitute for sustained scale and operational-history evidence.

## Evidence base

- `HERCULES-v10.3.4-NINE-STEP-VERIFICATION.md`
- `HERCULES-v10.3.4-CROSS-REGION-RECOVERY-REPORT.md`
- `HERCULES-v10.3.4-DEVBRAIN-LIVE-FABRIC-REPORT.md`
- `HERCULES-v10.3.4-LAUNCH-GATE-REPORT.md`
- `docs/NINE-STEP-INFRASTRUCTURE-COMPLETION.md`
- `supabase/migrations/20260922_01` through `20260922_07`
- Production release `release-1ab9a3e0-2df1-400d-a324-502e084b4c52`
- Recovery snapshot `4b07f4fa-a504-4da6-ac40-57632946fb66`

External live-source retrieval was unavailable during this run. No unverified current vendor claim was used in the numerical score. The assessment uses the repository's verified evidence and stable industry benchmark domains: supply-chain integrity, zero trust, reliability, recovery, observability, performance, operational automation, and independent assurance.
