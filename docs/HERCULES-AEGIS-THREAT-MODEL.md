# Hercules AEGIS Threat Model Addendum

## Trust boundary

AEGIS introduces a deception boundary between untrusted inbound sessions and protected Hercules assets. A hostile-classified session may enter the Mirage Fabric, which MUST expose synthetic data only and MUST NOT have a route to protected production assets.

## Invariants

- Classification input is untrusted and bounded before scoring.
- Normal traffic is not silently diverted.
- Suspicious traffic receives reversible friction before hostile containment unless a trusted high-confidence indicator is present.
- Hostile sessions receive `realAssetAccess=false`.
- Mirage sessions use `networkPolicy=isolated-no-egress` and `dataPolicy=synthetic-only`.
- All plans and sessions enforce `outboundCounterattack=false`.
- No AEGIS component may scan, exploit, modify, impair, or deploy code to a remote client.
- Attacker-controlled observations cannot directly authorize privileged configuration or production changes.

## Failure mode

If containment cannot prove isolation, AEGIS must deny the hostile session rather than fall through to real assets.
