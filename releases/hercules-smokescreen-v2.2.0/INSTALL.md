# Hercules SmokeScreen Sentinel v2.2.0 — Install

## Requirements

- Node.js 22 or newer.
- Infrastructure you own or are authorized to defend.
- A server-side HMAC key of at least 32 bytes.
- A trusted telemetry adapter.

SmokeScreen runtime code has no package-manager runtime dependency.

## Imports

```js
import {
  createSmokeScreenAgent,
  createSmokeScreenDecision,
  createSmokeScreenEnforcementPlan,
  createMirageFabric,
} from "./hercules-runtime/smokescreen-agent.mjs";

import {
  createAttackEnrichment,
  SMOKESCREEN_ATTACK_CATALOG,
} from "./hercules-runtime/smokescreen-attack-enrichment.mjs";

import {
  createForgeSmokeScreenObserver,
  deriveForgeSmokeScreenKey,
} from "./hercules-runtime/smokescreen-forge-ingress.mjs";
```

## Safe first deployment

Use Forge `OBSERVE_ONLY` first. ATT&CK enrichment is descriptive metadata only and grants no response authority.

Do not enable live Mirage diversion until false-positive review, isolation proof, rollback testing, no-egress proof, and production secret/data separation are verified.
