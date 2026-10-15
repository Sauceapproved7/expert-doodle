# Smallz bounded replay window

This source-only change fixes cross-instance out-of-order trace arrival. Previously a lower sequence was rejected even when never claimed. The updated SQL function serializes claims per source, deduplicates accepted sequence values, and permits unseen values within a 4,096-position window.

Pre-upgrade history remains rejected using a legacy floor. Values older than the bounded window fail closed. The database migration runs only in disposable PostgreSQL CI; no live Supabase schema, Render deployment, secrets, payment, or browser enforcement is changed.

The test suite verifies duplicates, delayed requests, expired values, role restrictions and rollback. Before production: validate staging concurrency with real browser workers, migration performance, privilege boundaries and deployed revision. Keep browser trace enforcement disabled until staging passes. Recovery: discard disposable staging data; preserve production replay history.
