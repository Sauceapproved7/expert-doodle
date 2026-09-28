# Hercules SmokeScreen Sentinel v2.1.0 — Security Boundary

SmokeScreen is defensive deception software.

## Invariants

- Scope is `OWNED_INFRASTRUCTURE_ONLY`.
- `outboundCounterattack=false`.
- Mirage is `SYNTHETIC_ONLY`.
- Mirage network policy is `ISOLATED_NO_EGRESS`.
- Mirage has no production credentials.
- Mirage has no customer data.
- Mirage has no payment keys.
- Mirage has no signing authority.
- If isolation cannot be proven, fallback is `DENY`.
- Learning recommendations have `executionAuthority=false`.
- Learning recommendations have `autoApply=false`.

## Prohibited use

The release is not designed to:

- hack back;
- scan third-party infrastructure without authorization;
- exploit remote systems;
- impair attacker devices or networks;
- steal credentials or data from remote parties;
- deploy payloads to external systems.

## Production status

The current Forge ingress adapter is observe-only. The public preview does not claim production enforcement certification.

## Reporting

Use the repository's root `SECURITY.md` process for vulnerability reporting.
