# Hercules SmokeScreen Sentinel v2.2.0 — Security Boundary

SmokeScreen is defensive deception software for owned or explicitly authorized infrastructure.

## ATT&CK enrichment boundary

ATT&CK output is **candidate behavior mapping**, not attribution.

- `actorAttribution=false`
- `campaignAttribution=false`
- `automaticResponseAuthority=false`
- `outboundCounterattack=false`

Heuristic mappings carry confidence and corroboration requirements. Raw routes are reduced to bounded route categories before output.

The enrichment layer explicitly refuses to infer:

- T1046 Network Service Discovery from web route probing alone;
- T1078 Valid Accounts from credential attempts without evidence of successful account use.

## Existing Mirage invariants

- `OWNED_INFRASTRUCTURE_ONLY`
- `SYNTHETIC_ONLY`
- `ISOLATED_NO_EGRESS`
- no production credentials
- no customer data
- no payment keys
- no signing authority
- isolation failure -> `DENY`

The current Forge ingress remains observe-only.
