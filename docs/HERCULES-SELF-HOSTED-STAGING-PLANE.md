# Hercules self-hosted staging plane

## Completed scope

1. PostgreSQL 16 staging database isolated on an internal container network.
2. Hercules health API backed by PostgREST and the staging database.
3. Ordered, fail-closed migration runner.
4. Schema constraints and seeds that permit synthetic fixture data only.
5. Supabase-compatible JWT claim ownership model using `request.jwt.claim.sub` and RLS.
6. Guarded load harness plus database backup and restore-verification primitives.
7. One-command lifecycle through `npm run hercules:staging -- <action>`.
8. Loopback-only ports, generated secrets, no production references, and volume-removing teardown.

## Commands

```bash
npm run hercules:staging -- up
npm run hercules:staging -- verify
npm run hercules:staging -- benchmark
npm run hercules:staging -- backup
npm run hercules:staging -- restore-test
npm run hercules:staging -- down
```

`all` starts, verifies, benchmarks, backs up, restores into a temporary database, re-verifies the restored data, and removes the temporary restore database. `down` removes the isolated database volume and all synthetic data.

## Safety properties

- The API and database bind only to `127.0.0.1`.
- The Docker network is internal.
- No production or recovery project ID appears in the runtime files.
- All fixture identities use the reserved `.invalid` domain.
- RLS is enabled on every exposed staging table.
- Authorization uses the immutable JWT subject, never user-editable metadata.
- The health API reports `customerData: false` and refuses non-health routes.
- Secrets are generated locally into a mode-0600 `.env` file and are not committed.

## Verification status

The configuration, isolation rules, migrations, API boundary, synthetic-data constraints, and recovery primitives are covered by automated validation. This workspace does not have Docker installed, so container startup and live PostgreSQL restore execution must occur on a Docker-capable host.

The GitHub Actions workflow `.github/workflows/hercules-global-staging-benchmark.yml` supplies that Docker runner, performs the full staging and recovery sequence, and recalculates the global infrastructure benchmark only after passing evidence exists.
