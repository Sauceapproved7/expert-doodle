# Hercules SmokeScreen Sentinel v2.2.0

**Release class:** Public Community Preview  
**License:** Apache-2.0  
**Security posture:** Defensive-only

v2.2 adds bounded MITRE ATT&CK enrichment to the SmokeScreen v2.1 deception and containment core.

## New in v2.2

- Candidate ATT&CK behavior mappings from normalized SmokeScreen telemetry.
- Direct mapping for explicit credential-stuffing evidence to **T1110.004**.
- Heuristic mappings for repeated password guessing, web route enumeration, identity enumeration, and possible public-facing application exploitation.
- Anti-overmapping guards: route probing does not become Network Service Discovery without network-service telemetry; credential attempts do not become Valid Accounts without successful-account-use evidence.
- No actor attribution, campaign attribution, automatic response authority, or outbound counterattack.
- Raw request routes are not emitted in enrichment output.

## Defensive core

SmokeScreen still provides adaptive Mirage topology, honeytokens, no-egress synthetic isolation, DENY fallback, tamper-evident evidence, the False-Positive Governor, and Evidence-Locked Learning.

## Benchmark

The last verified global-readiness coverage benchmark remains **64/100**. That score predates this v2.2 enrichment and is intentionally not changed inside the feature release.

The labeled synthetic fixture remains separate from the global score and is not a production detection-rate claim.

## Runtime

- `hercules-runtime/smokescreen-agent.mjs`
- `hercules-runtime/smokescreen-forge-ingress.mjs`
- `hercules-runtime/smokescreen-attack-enrichment.mjs`

## Verification

- `tests/hercules-smokescreen-agent.test.mjs`
- `tests/hercules-smokescreen-forge-ingress.test.mjs`
- `tests/hercules-smokescreen-attack-enrichment.test.mjs`
- `tests/hercules-smokescreen-global-benchmark.test.mjs`
- `tests/hercules-smokescreen-release-package.test.mjs`

See `INSTALL.md`, `SECURITY.md`, and `RELEASE-NOTES.md`.
