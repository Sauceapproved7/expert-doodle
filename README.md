# Hercules

Hercules is the SauceApproved canonical software platform repository.

Canonical source: `Sauceapproved7/expert-doodle`.

## Runtime surfaces

- `hercules-forge/` — builder, control plane, identity, audit, preview, release and runtime-data services.
- `hercules-models/` — model plane and embedded native runtimes.
- `hercules-training/` — training, evaluation, checkpoint and activation pipeline.
- `hercules-video/` — video planning, rendering, quality and execution coordination.
- `hercules-hurc/` — HURC token, Base Sepolia browser/RPC/signing components.
- `staging-plane/` — isolated synthetic PostgreSQL/PostgREST/Forge staging.
- `observability/` — sampled SLO policy.
- `scripts/` — validation, benchmarking, security and operator tooling.

The exact owner-code and external-infrastructure boundaries are defined in
`governance/owner-code-policy.json`.

## Verify the repository

Core checks:

```sh
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
node --test tests/hercules-forge*.test.mjs
node --test tests/hercules-hurc-*.test.mjs
```

Docker-capable staging:

```sh
node scripts/staging-plane.mjs all
```

The performance harness is intentionally loopback/fixture-only. Passing staging
benchmarks are not represented as production-scale or multi-region operating
history.

## Security

Read:

- `SECURITY.md`
- `docs/HERCULES-THREAT-MODEL.md`
- `docs/HERCULES-FORGE-AUDIT-SECURITY-V1.4.md`

HURC signing code is testnet-only unless a separate security review and explicit
production authorization state otherwise.

## Provenance

`IP_PROVENANCE.md` records canonical-source, rights, provenance and merge rules.
The owner-code gate rejects undeclared runtime dependencies and unapproved CI
actions. Release evidence can generate a runtime manifest, SPDX SBOM and signed
GitHub artifact attestation.

## Reliability

`observability/slo-baseline.json` defines the sampled staging objectives and
history gate. Hercules explicitly distinguishes sampled staging evidence from
continuous production SLO attainment.

## Current engineering rule

Do not let maturity claims advance faster than machine-verifiable evidence.
