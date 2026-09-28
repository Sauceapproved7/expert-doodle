# Hercules SmokeScreen Sentinel — Global Benchmark

Status: evidence-based global capability benchmark plus synthetic fixture evidence

## Executive result

**Global readiness coverage: 64/100.**

This score is an internal evidence-coverage rubric. It is not an independent certification, analyst ranking, or claim that Hercules is the best deception product globally.

Separately, the controlled synthetic fixture passed with:

- 6/6 hostile scenarios detected;
- 6/6 hostile scenarios routed to deception;
- 0/6 benign or ambiguous scenarios falsely routed to deception;
- 0 safety-boundary violations;
- approximately 0.05 ms p95 policy-decision latency across 3,000 decisions in the verified CI run.

Those synthetic results are **not** a 100/100 global market score and are not production detection-rate evidence.

## Method

The global benchmark uses public primary-source documentation from current deception-security platforms and MITRE defensive frameworks to define the contemporary capability bar. Hercules is scored only on capabilities implemented and evidenced in the canonical repository.

Each domain is scored from 0 to 10. Missing public evidence for another vendor is not treated as proof that the vendor lacks a capability.

## Hercules global-readiness scorecard

| Domain | Score | Current evidence |
|---|---:|---|
| Adaptive deception and moving synthetic topology | 9/10 | Mirage Fabric rotates synthetic namespaces, routes, records, and honeytokens. |
| High-signal lures and honeytokens | 9/10 | Honeytoken touch is a critical signal; synthetic honeytokens are session-scoped. |
| Isolation, no-egress safety, and deny fallback | 10/10 | Mirage requires synthetic-only/no-egress controls and fails closed to DENY. |
| False-positive governance | 9/10 | False-Positive Governor requires corroboration across independent evidence families except honeytoken contact. |
| Tamper-evident evidence and governed learning | 10/10 | HMAC audit chain plus Evidence-Locked Learning Capsule with no auto-apply authority. |
| High-interaction service realism | 5/10 | Synthetic topology/data are implemented; broad full-service/digital-twin emulation is not yet proven. |
| Environment breadth and discovery | 3/10 | Current proof is application/Forge oriented, not broad IT/OT/cloud/identity discovery. |
| Automated production containment | 5/10 | Enforcement plans exist; Forge ingress is intentionally observe-only today. |
| SIEM/SOAR/EDR/XDR integration breadth | 1/10 | No verified broad production connector matrix yet. |
| ATT&CK/TTP enrichment and external maturity | 3/10 | v2.2 candidate ATT&CK mapping is implemented; broader IOC/TTP context and large external red-team/production proof are not yet established. Score held pending a deliberate benchmark rerun. |
| **Total** | **64/100** | |

## Current global reference bar

### MITRE Engage and D3FEND

MITRE Engage frames adversary engagement around deception and denial, maps it to ATT&CK, and explicitly recommends avoiding hack-back. MITRE D3FEND recognizes decoy environments, decoy files, decoy session tokens, decoy user credentials, decoy network resources, and isolation techniques.

### Acalvio ShadowPlex

Acalvio publicly documents adaptive deception, honeytokens, HoneyPaths, broad IT/OT/cloud/identity coverage, and integrations with SIEM, SOAR, EDR, and XDR.

### Fortinet FortiDeceptor

Fortinet publicly documents dynamic deception across IT/OT/IoT, automated endpoint quarantine, forensics, IOC/TTP collection, and integrations with SIEM, SOAR, EDR, and other Fortinet controls.

### CyberTrap Engage

CyberTrap publicly documents adaptive digital twins, synthetic data, dynamic decoy swarms, honeytokens, environment mapping, attacker-skill adaptation, threat intelligence, and SOC integrations.

### Proofpoint Identity Threat Defense

Proofpoint publicly documents 75+ agentless deception techniques, identity-risk discovery/remediation, forensic collection, and published red-team exercise results.

### Thinkst Canary

Thinkst publicly documents high-signal decoys and Canarytokens, noise-reducing alert thresholds, many token types, and alert integrations including webhook, syslog, SIEM, and automation paths.

### SentinelOne Singularity Hologram

SentinelOne publicly documents network deception decoys whose telemetry supports investigations and adversary intelligence in its broader identity/XDR platform.

### Microsoft Defender for Identity

Microsoft Defender for Identity supports honeytoken accounts where any sign-in activity triggers an alert.

## Hercules strengths

Hercules is strongest today in the defensive decision core:

- adaptive Mirage topology;
- deterministic honeytoken generation;
- explicit synthetic-only/no-egress isolation;
- deny fallback when isolation cannot be proven;
- no hack-back invariant;
- tamper-evident evidence;
- false-positive corroboration governor;
- evidence-locked learning with no production execution authority.

## Gaps versus mature global platforms

1. Broader IT, OT, identity, cloud, endpoint, and industrial coverage.
2. A verified SIEM/SOAR/EDR/XDR connector matrix.
3. More high-interaction service and digital-twin realism.
4. Broader ATT&CK/TTP and IOC context beyond the bounded v2.2 candidate mappings.
5. Live production containment beyond observe-only Forge ingress.
6. Large independent red-team, customer, multi-region, and sustained-load evidence.

## Hercules differentiators

### False-Positive Governor

A high numerical risk score alone does not authorize deception. Except for honeytoken contact, SmokeScreen requires corroboration across independent evidence families before routing a session into Mirage.

### Evidence-Locked Learning Capsule

Engagement telemetry can produce signed defensive recommendations, but recommendations:

- have no execution authority;
- cannot auto-apply;
- require review;
- use an allowlist of defensive recommendation types;
- carry evidence integrity data;
- fail verification if tampered with.

These are Hercules differentiators. They are not claimed as globally unique without dedicated prior-art and product-feature research.

## Synthetic fixture evidence

Scope: `SYNTHETIC_FIXTURE_ONLY`

Thresholds:

- false-positive deception rate: 0%;
- hostile detection rate: 100%;
- hostile deception rate: 100%;
- deception precision: 100%;
- safety-boundary violations: 0;
- at least one ambiguous benign scenario protected by the governor;
- p95 decision latency: <=10 ms in CI.

Verified run:

- 12 labeled scenarios;
- 3,000 decision samples;
- p95 approximately 0.05 ms;
- all assertions passed.

## Non-claims

This benchmark does not claim:

- a 100/100 global-market score;
- production detection rates;
- proprietary competitor performance testing;
- independent penetration-test certification;
- global product leadership.

## Public source set

- MITRE Engage: https://www.mitre.org/news-insights/impact-story/mitre-engage-framework-and-community-cyber-deception
- MITRE D3FEND Deceive: https://d3fend.mitre.org/tactic/d3f%3ADeceive/
- Acalvio ShadowPlex: https://www.acalvio.com/shadowplex-platform/
- Fortinet FortiDeceptor: https://www.fortinet.com/products/fortideceptor
- CyberTrap Engage: https://cybertrap.com/platform
- Proofpoint Identity Threat Defense: https://www.proofpoint.com/us/products/identity-threat-detection-response
- Thinkst Canary: https://canary.tools/
- SentinelOne Hologram reference: https://www.sentinelone.com/press/sentinelone-completes-acquisition-of-attivo-networks/
- Microsoft Defender for Identity entity tags: https://learn.microsoft.com/en-us/defender-for-identity/entity-tags

## Next benchmark gates

Before any global-leadership claim:

1. collect observe-only production telemetry and review false positives;
2. rerun the global benchmark after v2.2 ATT&CK enrichment and add broader IOC/TTP context;
3. verify a local enforcement adapter and rollback path;
4. ship SIEM/SOAR export contracts;
5. add high-interaction Mirage service profiles;
6. run sustained-load and multi-instance testing;
7. obtain independent red-team or penetration-test evidence;
8. prove multi-environment production behavior.
