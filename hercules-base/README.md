# Hercules Base

Backend operating-system control plane for Hercules.

Core owned capabilities:

- **Blueprint Engine** — backend intent to deterministic runtime architecture.
- **Guardian** — security, RLS, audit, backup and isolation requirements compiled into each blueprint.
- **Portability Capsule** — machine-readable migration and recovery requirements so projects are not designed around vendor lock-in.

Run the regression contract with:

```sh
node --test tests/hercules-base*.test.mjs
```

The current staging runtime is mounted from this directory by
`staging-plane/compose.yml`.

See `docs/HERCULES-BASE-V1.md` for scope, capability status and ownership
boundaries.
