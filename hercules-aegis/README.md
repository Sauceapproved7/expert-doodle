# Hercules AEGIS — Adaptive Deception & Containment

AEGIS is an owner-code defensive security plane for Hercules.

## Mirage Fabric

Instead of attacking a hostile client, AEGIS changes what that client can reach inside the protected Hercules boundary:

1. **Sentinel scoring** combines authentication anomalies, reconnaissance breadth, burst behavior, honeytoken contact, and trusted threat indicators.
2. **Progressive response** keeps normal traffic untouched, applies friction to suspicious traffic, and diverts high-confidence hostile sessions.
3. **Mirage Fabric** creates short-lived synthetic API topology, records, namespaces, and honeytokens unique to the quarantined session.
4. **Session quarantine** denies the quarantined identity access to real assets.
5. **Adaptive tarpitting** can consume attacker automation time using bounded server-side delays and synthetic responses.
6. **Forensic event chain** records the defensive sequence for investigation and later hardening.
7. **Self-hardening feedback** is designed to produce defensive recommendations/rules only after review; it never turns observed attacker input directly into privileged production changes.

## Non-negotiable safety boundary

AEGIS has no hack-back capability. It does not exploit, scan, install software on, damage, or otherwise act upon a remote attacker's device or third-party network. All deception and containment occurs within infrastructure the owner is authorized to defend.

Every containment plan and mirage session carries `outboundCounterattack: false`. Mirage data is synthetic-only and isolated with no egress by default.

## Initial runtime API

- `classifyThreat(signal)`
- `buildContainmentPlan(verdict)`
- `createMirageSession({tenantId, verdict})`
- `buildAdaptiveMirage(session, observation)`

The initial implementation is intentionally dependency-free and uses only Node built-ins to preserve the Hercules owner-code runtime boundary.
