# Hercules SmokeScreen Sentinel — Global Benchmark
Date: 2026-09-28
Status: evidence-based architecture benchmark; synthetic performance fixture

## Benchmark boundary

This benchmark compares publicly documented deception-security capabilities against the current Hercules SmokeScreen implementation. It does **not** claim proprietary competitor performance testing, production detection rates, or external penetration-test assurance.

The executable benchmark in `scripts/smokescreen-global-benchmark.mjs` measures only Hercules against a labeled synthetic fixture.

## Current external reference bar

| Reference | Publicly documented capability bar |
|---|---|
| MITRE Engage | Plan adversary engagement around Prepare, Expose, Affect, Elicit, and Understand; use deception/denial while avoiding hack-back. |
| MITRE D3FEND | Defensive deception includes decoy environments, files, network resources, personas, session tokens, and user credentials, alongside isolation controls. |
| Acalvio ShadowPlex | Dynamic/adaptive deception, HoneyPaths, honeytokens, identity/cloud/IT/OT coverage, automated placement, and SIEM/SOAR/EDR/XDR integration. |
| Fortinet FortiDeceptor | Asset-matched IT/OT/IoT decoys, attack isolation/quarantine, forensics, SIEM/SOAR/EDR integration, and on-demand deception deployment. |
| CyberTrap Engage | Adaptive digital twins, lures/breadcrumbs/honeytokens, synthetic data, behavioral adaptation, attacker-TTP intelligence, and SOC integrations. |
| SentinelOne Singularity Hologram | Network decoys that lure adversaries and generate telemetry for investigation/adversary intelligence, integrated with identity/XDR capabilities. |
| Microsoft Defender for Identity | Honeytoken accounts where sign-in activity is treated as an alertable trap signal. |
| Proofpoint Identity Threat Defense | Agentless identity deceptions and lateral-movement detection/response. |
| Thinkst Canary | Lightweight decoys and Canarytokens designed as high-signal compromise markers with rapid deployment. |

## Hercules capability comparison

| Capability | Global enterprise bar | Hercules evidence | Status |
|---|---|---|---|
| High-signal honeytokens | Common | Honeytoken touch forces critical containment guidance | Implemented |
| Adaptive deception | Expected in leading platforms | Mirage Fabric rotates synthetic namespaces/routes/honeytokens by generation | Implemented |
| No-egress isolation | Strong defensive practice | Mirage requires `ISOLATED_NO_EGRESS`; failure fallback is `DENY` | Implemented |
| No hack-back | MITRE Engage-aligned | `outboundCounterattack=false` is invariant | Implemented |
| False-positive control | Low-noise/high-confidence alerts are a market expectation | v2.1 requires corroboration across independent evidence families before deception, except honeytoken contact | Implemented in this benchmark branch |
| Tamper-evident evidence | Important for forensics/audit | HMAC audit chain and checkpoints | Implemented |
| Learning from engagements | Leading platforms convert engagements into intelligence | Evidence-Locked Learning Capsule produces signed, review-required hardening recommendations with no auto-apply authority | Implemented in this benchmark branch |
| TTP/ATT&CK enrichment | Common in mature enterprise offerings | No full ATT&CK/TTP enrichment pipeline proven | Gap |
| High-interaction service realism | Mature platforms offer broad decoy/service fidelity | Mirage currently synthesizes bounded routes/data, not full service emulation | Partial |
| Identity/cloud/OT breadth | Leading suites span multiple environments | Current proof is Hercules application/runtime oriented | Gap |
| SIEM/SOAR/EDR/XDR integration | Common enterprise requirement | No broad production integration matrix proven | Gap |
| Automated local quarantine | Common in enterprise offerings | Decision/enforcement plan exists; production enforcement adapter is staged separately | Partial |
| Global-scale production evidence | Enterprise expectation | No multi-region or production-scale benchmark claim | Gap |

## Hercules differentiators added by the benchmark

### 1. False-Positive Governor

A high numerical score alone is not enough to divert a non-honeytoken session into deception. The governor requires corroboration across at least two independent evidence families. This explicitly protects ambiguous legitimate behavior from being trapped by a single class of signal.

Honeytoken contact remains a special high-confidence case because the token has no legitimate business purpose.

### 2. Evidence-Locked Learning Capsule

SmokeScreen can summarize signed audit evidence into bounded hardening recommendations. The capsule:

- contains no production execution authority;
- cannot auto-apply changes;
- requires review;
- uses an allowlist of defensive recommendation types;
- carries an evidence digest and HMAC signature;
- fails verification if recommendations are tampered with.

This creates a learning loop without allowing attacker-controlled activity to rewrite production policy.

## Executable fixture thresholds

The synthetic benchmark requires:

- false-positive deception rate: **0%** on the labeled benign fixture;
- hostile detection rate: **100%** on the labeled hostile fixture;
- hostile deception rate: **100%** on the labeled hostile fixture;
- deception precision: **100%** on the labeled fixture;
- safety-boundary violations: **0**;
- at least one ambiguous benign scenario protected by the False-Positive Governor;
- p95 policy-decision latency: **<= 10 ms** in CI.

These thresholds are fixture assertions only.

## External references

- https://www.mitre.org/news-insights/impact-story/mitre-engage-framework-and-community-cyber-deception
- https://d3fend.mitre.org/
- https://www.acalvio.com/shadowplex-platform/
- https://www.fortinet.com/products/fortideceptor
- https://cybertrap.com/platform
- https://www.sentinelone.com/press/sentinelone-completes-acquisition-of-attivo-networks/
- https://learn.microsoft.com/en-us/defender-for-identity/entity-tags
- https://www.proofpoint.com/us/illusive-is-now-proofpoint
- https://thinkst.com/

## Next benchmark gates

Before stronger live enforcement, Hercules still needs evidence for:

1. observe-only production telemetry quality and false-positive review;
2. ATT&CK/TTP enrichment from normalized telemetry;
3. a local production enforcement adapter with rollback evidence;
4. SIEM/SOAR export contract;
5. high-interaction Mirage service profiles;
6. sustained-load and multi-instance evidence.
