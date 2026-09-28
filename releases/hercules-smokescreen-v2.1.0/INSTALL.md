# Hercules SmokeScreen Sentinel v2.1.0 — Install

## Requirements

- Node.js 22 or newer.
- Infrastructure you own or are authorized to defend.
- A server-side HMAC key of at least 32 bytes.
- A trusted telemetry adapter.

No package-manager dependency is required by the SmokeScreen runtime.

## Option A — use the canonical repository

Clone the public repository and import the runtime directly:

```js
import {
  createSmokeScreenAgent,
  createSmokeScreenDecision,
  createSmokeScreenEnforcementPlan,
  createMirageFabric,
} from "./hercules-runtime/smokescreen-agent.mjs";
```

For Forge observe-only ingress:

```js
import {
  createForgeSmokeScreenObserver,
  deriveForgeSmokeScreenKey,
} from "./hercules-runtime/smokescreen-forge-ingress.mjs";
```

## Option B — verified CI artifact

The **Hercules SmokeScreen Public Package** workflow builds an exact-commit source artifact named:

`hercules-smokescreen-v2.1.0-<commit-sha>`

The artifact includes the canonical runtime, benchmark runner, benchmark report, threat model, tests, LICENSE, SECURITY policy, and `smokescreen-release-manifest.json` with SHA-256 hashes.

## Safe first deployment

Start with `OBSERVE_ONLY`.

Do not enable live Mirage diversion until:

1. real telemetry false positives have been reviewed;
2. isolation controls are independently verified;
3. rollback is tested;
4. production credentials and customer data are proven absent from Mirage;
5. no-egress enforcement is proven;
6. alerting and operator response are ready.

## Boundary

Do not use SmokeScreen to retaliate against, scan, exploit, damage, or deploy code to systems outside your authorized defensive scope.
