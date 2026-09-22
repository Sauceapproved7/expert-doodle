# Hercules fixture performance harness

The harness measures latency, throughput, errors, response bytes, and p50/p95/p99 latency for safe read-only health endpoints.

## Safety boundary

- Loopback targets only: `localhost`, `127.0.0.1`, or `::1`.
- GET only.
- Allowlisted paths only: `/api/health`, `/api/v10/health`, `/api/v10/readiness`.
- URLs containing credentials, queries, or fragments are rejected.
- Execution requires `--confirm-fixture`; otherwise the command performs a dry run.
- Production, preview, remote, and customer targets are rejected in code.

## Profiles

| Profile | Shape |
|---|---|
| `smoke` | 5 requests, concurrency 1 |
| `load` | 200 requests, concurrency 8 |
| `stress` | 100 requests each at concurrency 4, 8, 16, and 24 |
| `spike` | 500 requests, concurrency 50 |
| `soak` | 15 minutes, concurrency 6 |

## Run

Start the local fixture application, then run:

```bash
npm run hercules:perf:smoke
npm run hercules:perf -- --profile load --confirm-fixture
```

When the full Next.js runtime is unavailable, start the dedicated read-only fixture with `npm run hercules:perf:fixture`. It exposes only the three benchmark health routes on `127.0.0.1`.

Results are written to `benchmarks/performance/` as machine-readable JSON. A run fails when the error rate exceeds 1%, p95 exceeds 500 ms, or p99 exceeds 1,000 ms.
