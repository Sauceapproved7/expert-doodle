# Hercules Launch Gate Live Watch v1

## Goal

Use the already-deployed Hercules `hercules-launch-gate` **read-only GET** status to catch stale launch evidence independently of documentation and old green checks, without changing production state. This adds a live safeguard to the existing GitHub release-tag admission gate.

## Execution

- `.github/workflows/hercules-launch-gate-live-watch.yml` runs every 15 minutes on the default branch (subject to GitHub Actions scheduler delivery) and can be run manually.
- PRs run offline tests only. Scheduled/manual workflows perform the read-only live probe.
- On a `hercules-public-v*` tag, `.github/workflows/hercules-release-gate-v1.yml` runs the same fresh-status probe **before** accepting the evidence-only release commit.
- The target is fixed to `https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch-gate`. No tokens, POSTs, credentials, or service-role keys are used.

## Fail-closed checks

The observer refuses to report operational readiness when:
1. the URL returns an error or invalid JSON;
2. the latest gate check is missing, more than 30 minutes old, or more than 60 seconds in the future;
3. readiness flags are missing, non-Boolean or internally inconsistent;
4. public registration is open even though the live gate is not fresh and ready;
5. the live registration state cannot be determined.

The observer **does not treat an expected held public-registration switch or a fresh blocked launch as a monitor failure**. Those states are operationally valid.

GitHub Actions surfaces a failing check when the gate is stale or invalid. Output is intentionally limited to status, timestamps, and blocker codes; detailed ledger evidence and secrets are never printed.

## Critical scope limits

This is a **watch** and an extra public-release CI constraint, not a replacement for the secured Supabase gate refresh. The existing `supabase/migrations/20260930022000_hercules_launch_gate_freshness_v1.sql` defines a credential-protected refresh, but a source file or test does **not** prove the live production scheduler was installed. A stale gate must remain blocked until the authorized service-side refresh is proven running.

This does not automatically block every Render deploy, change Shopify checkout, touch orders or payments, enable the public-registration switch, sign a release, generate owner approvals, or claim that a public release occurred. Existing commerce should continue operating. New public launch candidates are held when evidence is stale.

## Verification

```sh
node --test tests/hercules-launch-gate-live-observer.test.mjs
node scripts/hercules-launch-gate-live-observer.mjs
```

The second command exits nonzero if stale/unknown.

## Provenance

- Original project-authored Hercules/SauceApproved source with AI assistance.
- Node.js built-ins only, with the existing deployed Supabase status endpoint.
- GitHub Actions and Supabase are externally operated infrastructure, not project-owned technology.
- Differentiators: credential-free independent freshness sentinel and explicit separation between **healthy monitoring** and **public release approval**.
