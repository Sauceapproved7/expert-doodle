# Hercules verified performance evidence

Date: 2026-09-22 UTC

## Executed isolated staging run

GitHub Actions run `35714874182` completed successfully against the synthetic, loopback-only Hercules staging plane. The harness rejects remote and production targets and permits no mutations through the benchmark HTTP path.

| Profile | Requests | Errors | Throughput | p50 | p95 | p99 | Result |
|---|---:|---:|---:|---:|---:|---:|---|
| Load | 200 | 0 | 552.55 req/s | 7.98 ms | 20.50 ms | 151.12 ms | Pass |
| 15-minute soak | 2,010,084 | 0 | 2,233.42 req/s | 2.38 ms | 4.28 ms | 6.93 ms | Pass |

Thresholds: error rate no more than 1%, p95 no more than 500 ms, and p99 no more than 1,000 ms.

After the soak, database verification passed again for synthetic identities, synthetic records, and health state.

Evidence artifact: `staging-performance-35714874182-1`

Artifact digest: `sha256:981e781ac14b31d3af1b044c06066f3c3a365f31fac0f90fdf90a2eec1b77711`

These results validate the isolated staging implementation and benchmark harness. They do not claim production capacity, customer workload capacity, or multi-region scale.

## Earlier local fixture validation

The earlier loopback fixture runs also passed configured thresholds:

| Profile | Requests | Errors | Throughput | p50 | p95 | p99 | Result |
|---|---:|---:|---:|---:|---:|---:|---|
| Smoke | 5 | 0 | 148 req/s | 1.8 ms | 23.9 ms | 23.9 ms | Pass |
| Load | 200 | 0 | 1,231 req/s | 4.5 ms | 17.8 ms | 31.5 ms | Pass |
| Stress | 400 | 0 | 1,501 req/s | 4.3 ms | 23.2 ms | 40.6 ms | Pass |
| Spike | 500 | 0 | 1,768 req/s | 22.0 ms | 68.8 ms | 94.9 ms | Pass |
