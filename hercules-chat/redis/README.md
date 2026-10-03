# Hercules Redis Weighted Admission

This directory is the production-oriented Redis admission boundary for AI inference.

## Contract

Admission is one atomic Redis Lua decision covering:

1. weighted tokens-per-minute capacity;
2. requests-per-minute capacity;
3. concurrent in-flight requests;
4. daily/monthly reserved spend budgets;
5. an idempotent reservation record.

The reservation is created in the same script as the debit and concurrency increment. Settlement is a second atomic script that:

- transitions `active -> settled` exactly once;
- decrements the concurrency lease;
- refunds unused token reservation without exceeding bucket capacity;
- refunds unused reserved budget;
- refreshes the token bucket `last_refill_ms` timestamp so a refund cannot be double-counted as elapsed refill time.

## Key layout

All keys use the same opaque tenant hash tag so Redis Cluster executes the multi-key script on one slot:

`rl:{t:<tenant-fingerprint>}:tpm`
`rl:{t:<tenant-fingerprint>}:rpm`
`rl:{t:<tenant-fingerprint>}:concurrency`
`rl:{t:<tenant-fingerprint>}:budget`
`rl:{t:<tenant-fingerprint>}:reservation:<request-id>`

The raw tenant identifier is never used as a Redis key.

## Admission lifecycle

```text
authenticated request
      |
      v
server-side token/cost estimate
      |
      v
atomic Redis admission
      |
      +---- denied ---> 429 / permanent request-size error
      |
      v
reservation active
      |
      v
model router
      |
      v
atomic settlement
      |
      +---- actual <= reserved ---> refund unused reservation
      |
      +---- actual > reserved ----> under_reserved evidence; no invented refund
```

A duplicate request ID is never charged twice. An active duplicate returns `idempotent_active`; callers must not start a second model execution.

## Runtime boundary

`admission.mjs` deliberately accepts a Redis client interface instead of adding a Redis package to the canonical repository. The client must expose:

- `scriptLoad(script)`
- `evalsha(sha, keyCount, ...keysAndArgs)`

The adapter reloads scripts after `NOSCRIPT`, because Redis script caches are not durable across restart/failover.

The canonical Hercules chat Edge Function is **not switched to Redis by this change**. Its existing Postgres reservation path remains the active enforcement path until a reviewed Redis deployment and runtime wiring are available. This keeps the current fail-closed production path intact while the Redis layer is built and tested independently.

## Policy guidance

For the example plan:

- 60,000-token burst = 60,000,000 microcredits;
- 120,000 TPM = 2,000 microcredits/ms;
- request reservation = input estimate + capped output + bounded overhead;
- reservation TTL must exceed the maximum expected inference/stream lifetime with margin.

Do not trust client-provided token counts. The gateway must assemble and estimate the actual model request server-side.

## Redis requirements

The scripts rely only on core Redis scripting/hash/string operations and Redis server time. Redis Lua scripts execute atomically; Redis Cluster requires all accessed keys to share one hash slot. Script SHA values should be loaded at startup and reloaded after `NOSCRIPT`.

The admission path should fail closed if Redis is unavailable. It must not silently convert a missing limiter into unlimited public or paid model access.
