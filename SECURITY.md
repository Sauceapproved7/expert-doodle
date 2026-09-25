# Hercules Security Policy

## Scope

This policy covers the canonical Hercules repository `Sauceapproved7/expert-doodle` and the runtime roots declared in `governance/owner-code-policy.json`.

## Supported code

Security fixes target the current canonical `main` line. Historical commits and archived artifacts are retained for provenance but are not treated as supported runtime releases unless explicitly tagged.

## Reporting a vulnerability

Do **not** publish exploitable details, credentials, private keys, seed phrases, bearer tokens, or proof-of-concept secrets in a public issue.

Prefer GitHub private vulnerability reporting / Security Advisories for this repository when available. If that channel is unavailable, contact the repository owner through a private authenticated channel and include:

- affected commit SHA and file/path;
- impact and prerequisites;
- minimal reproduction steps;
- whether secrets or customer data may be involved;
- suggested remediation, if known.

## Response rules

Hercules security changes should:

1. fail closed when configuration or authorization is missing;
2. preserve canonical provenance and commit history;
3. add a regression test for every confirmed vulnerability when practical;
4. avoid weakening owner-code, audit, isolation, or secret-handling boundaries;
5. isolate high-risk cryptographic changes from mainnet/real-value use until independently reviewed.

## Current high-risk boundaries

- Forge identity/session and workspace authorization;
- Forge preview/runtime execution;
- HURC signing and key custody;
- model/training remote runners;
- video external-process adapters;
- staging/database recovery;
- GitHub Actions and release provenance.

See `docs/HERCULES-THREAT-MODEL.md` for the current threat model.
