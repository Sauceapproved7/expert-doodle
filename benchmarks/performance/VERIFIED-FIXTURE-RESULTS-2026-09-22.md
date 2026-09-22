# Hercules verified fixture performance results

Date: 2026-09-22 UTC

The loopback-only, read-only fixture passed all configured latency and error thresholds. These results validate the benchmark harness and local HTTP execution path; they do not claim production capacity.

| Profile | Requests | Errors | Throughput | p50 | p95 | p99 | Result |
|---|---:|---:|---:|---:|---:|---:|---|
| Smoke | 5 | 0 | 148 req/s | 1.8 ms | 23.9 ms | 23.9 ms | Pass |
| Load | 200 | 0 | 1,231 req/s | 4.5 ms | 17.8 ms | 31.5 ms | Pass |
| Stress | 400 | 0 | 1,501 req/s | 4.3 ms | 23.2 ms | 40.6 ms | Pass |
| Spike | 500 | 0 | 1,768 req/s | 22.0 ms | 68.8 ms | 94.9 ms | Pass |

Thresholds: error rate no more than 1%, p95 no more than 500 ms, and p99 no more than 1,000 ms.

The soak profile is implemented but was not run because it intentionally lasts 15 minutes. The harness rejects remote and production targets in code.

Canonical machine-readable evidence:

- `verified-smoke.json`
- `verified-load.json`
- `verified-stress.json`
- `verified-spike.json`
