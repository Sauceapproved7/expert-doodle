# Hercules Proof–Consequence Binding v0.1

This artifact binds a verified Hercules Proof Object to a verified Hercules Consequence Envelope without merging their responsibilities.

## Invariants
- Both source objects must independently pass their own integrity verification.
- Both objects must bind to the same authorization evidence SHA-256.
- The binding records both source digests and the consequence disposition.
- The binding has its own deterministic SHA-256 integrity digest.
- executionAuthority is always false.

## Security boundary
A valid binding proves only that these exact recorded objects were joined under the same recorded authorization evidence. It does not prove that upstream claims are true, that all consequences were discovered, that an action is safe, or that execution is authorized. It cannot mint, expand, delegate, or substitute authority.

This module does not execute actions and does not alter either source object.
