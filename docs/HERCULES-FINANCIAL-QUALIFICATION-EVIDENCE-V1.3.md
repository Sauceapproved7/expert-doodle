# Hercules Financial Qualification Evidence v1.3

Date: 2026-09-27

## Purpose

v1.3 makes adapter qualification evidence durable, signed, freshness-aware, and
identity-bound.

v1.2 proves candidate adapter behavior during a qualification run. v1.3 answers the
next questions:

- Was that result persisted without tampering?
- Which production store, signing key, and regulated provider did it apply to?
- Is the evidence still fresh?
- Did any adapter identity change after qualification?
- Should production readiness automatically fall back to blocked?

The answer remains fail-closed.

## Signed evidence

`HerculesQualificationEvidenceStore` records successful qualification only when the
v1.2 result is fully qualified and both money-activation flags are already false.

Each record includes only bounded metadata:

- sequence number;
- qualification timestamp;
- expiration timestamp;
- sanitized adapter identity;
- SHA-256 identity fingerprint;
- signer key identifier;
- previous record hash;
- record hash;
- detached signature;
- `activationAllowed:false`;
- `externalRailsEnabled:false`.

The signer interface receives only a SHA-256 digest. Hercules does not request or persist
private signing-key material.

A verifier interface is required on every reopen. Every stored record is signature
verified before the store is accepted.

## Tamper evidence

The store verifies:

- exact record shape;
- sequence continuity;
- previous-hash continuity;
- sanitized identity fingerprint;
- canonical record hash;
- detached signature;
- snapshot head hash.

Any changed expiration timestamp, identity, signer key ID, or activation flag therefore
fails restore.

The file is written using a same-directory temporary file with mode 0600 followed by
atomic rename.

This is local durable evidence storage. It is not a substitute for a regulated records
archive, WORM retention service, external timestamp authority, or HSM audit log.

## Adapter identity binding

The qualification identity fingerprint binds the evidence to:

### Transactional store
- adapter ID;
- environment.

### Secret/key custody
- provider ID;
- environment;
- key ID.

### Regulated provider
- provider ID;
- environment;
- HTTPS endpoint;
- declared external-money-movement capability;
- declared custodial-deposit capability;
- sandbox/dry-run capability.

A change to those values changes the fingerprint.

## Freshness

Every qualification record has a bounded TTL. The default is seven days.

When the current time reaches the evidence expiration timestamp, status changes to:

- `ready:false`;
- `stale:true`;
- blocker requiring fresh qualification.

TTL is bounded to at most 90 days.

## Automatic requalification

The evidence store compares the latest signed identity fingerprint with the current v1.2
qualification result.

If the database adapter identity, KMS/HSM key ID, regulated-provider identity, endpoint,
or bound provider capabilities change:

- `identityChanged:true`;
- `ready:false`;
- requalification becomes mandatory.

Changing a production key therefore cannot silently inherit qualification evidence from
the previous key.

## Production readiness

v1.3 adds adapter qualification evidence as a required control in the v1.1 readiness
dossier.

Missing, stale, invalid, or identity-mismatched evidence automatically prevents the
dossier from becoming readiness-green.

The Owner console shows the state as:

- Fresh;
- Expired;
- Requalify;
- Missing.

## Service boundary

The running Financial service may receive the qualification-evidence store and current
adapter qualification as server-side dependencies.

Browser and customer request bodies cannot provide or alter these objects.

No API route records signed qualification evidence. Signing remains an offline/server-side
privileged operation.

## Activation invariant

v1.3 does not introduce real-money authority.

Every qualification record and every status result retains:

`activationAllowed: false`

`externalRailsEnabled: false`

There is no activation endpoint and no live-rail switch.
