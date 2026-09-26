# Hercules Forge Shared-Volume Identity Atomicity v1.6

## Purpose

v1.6 strengthens the v1.5 invite/recovery lifecycle for multiple Forge service processes sharing one persistent filesystem.

v1.5 serialized lifecycle mutation inside one Node.js process. v1.6 adds repository-owned cross-process coordination without introducing a lock package, external database, or hosted identity service.

## Atomic lock primitive

`ForgeIdentityStore` now creates lock directories under:

```text
identity/locks/<sha256(lock-key)>.lock
```

Lock acquisition uses atomic filesystem `mkdir`.

The lock name is a SHA-256 digest. Raw invite/recovery tokens and user emails are not written into lock paths.

Lock directories are created with mode `0700`.

Default limits:

- lock acquisition timeout: 15 seconds
- stale-lock threshold: 15 minutes

A request that cannot acquire its lifecycle lock before the timeout fails with HTTP-compatible status 503 instead of proceeding concurrently.

## Stale-lock recovery

If a lock directory remains beyond the stale threshold, a contender attempts to atomically rename that directory to a unique stale path and removes the renamed stale directory before retrying acquisition.

The rename operation makes stale-lock reclamation single-winner on filesystems that provide atomic same-filesystem rename semantics.

This handles process/container termination that would otherwise strand a lock indefinitely.

## Invite coordination

Invite acceptance uses two locks in a fixed order:

1. invite-token lock
2. normalized-email lock

The token lock ensures one invite token cannot be consumed concurrently by separate Forge processes.

The email lock prevents two different outstanding invite tokens for the same email from creating duplicate accounts concurrently.

Users created through an invite carry an internal `createdFromInviteId` marker. It is excluded from public user responses.

If a retry encounters the account created by the same invite, Forge can continue the membership operation. If the email belongs to a different invite/account, the competing invite becomes invalid.

## Recovery coordination

Password recovery uses two locks in a fixed order:

1. recovery-token lock
2. user credential lock

Every user password record has an internal password version.

New users begin at version 1. Existing pre-v1.6 users without the field are treated as version 1 for compatibility.

When Forge creates a recovery token, the token records the current password version.

On recovery completion Forge acquires the user recovery lock and compares:

```text
current user password version == recovery token password version
```

Only a matching token can proceed.

Successful recovery, while holding the credential-user lock:

- derives the next scrypt-v2 password hash
- revokes all existing sessions
- writes the new password hash
- increments the password version
- updates `passwordUpdatedAt`
- consumes the successful recovery token

Login for that same user acquires the same credential-user lock. Therefore an old-password login that wins the lock first creates a session which recovery subsequently revokes; if recovery wins first, the old-password login re-reads the changed password and fails.

A second older recovery link then fails and is removed because its recorded password version no longer matches.

This prevents two concurrently outstanding recovery links from both changing the password, even when different Forge processes receive the requests.

## Public user shape

Coordination metadata is internal.

Public user/session responses do not expose:

- `passwordHash`
- `passwordVersion`
- `createdFromInviteId`

## Cross-instance verification

The v1.6 regression suite creates independent `ForgeIdentityStore` instances against the same Forge root and verifies:

- one invite token has exactly one successful consumer
- two different invite tokens for the same email create only one account
- two outstanding recovery links produce only one successful reset
- old sessions are revoked
- only one of the competing new passwords becomes valid
- stale filesystem locks are reclaimed
- lifecycle token directories are empty after terminal consumption

This exercises the storage boundary directly rather than relying on one in-process queue.

## Security baseline

The Hercules security baseline now requires:

- atomic `mkdir` lock acquisition
- `0700` lock directories
- invite-token lock
- invite-email lock
- recovery-token lock
- credential-user lock
- password-version invalidation

## Filesystem boundary

The validated design assumes the Forge root resides on a filesystem that provides reliable atomic directory creation and same-filesystem rename semantics.

Local Linux filesystems and the existing Hercules single-host persistent-volume staging boundary fit that model.

v1.6 does not claim equivalent correctness for every distributed/network filesystem. Before using a network filesystem for multi-node Forge, its `mkdir`, visibility, consistency, timestamp, and rename semantics must be verified against this locking protocol.

A future transactional identity adapter backed by Hercules' persistent database layer can replace the filesystem coordination mechanism while preserving the v1.5 API contract.

## Remaining identity roadmap

v1.6 still does not provide:

- multi-factor authentication
- unrestricted public signup
- signed external lifecycle-token revocation evidence
- multi-region transactional identity state
- hardware-backed credentials/passkeys

Those remain separate milestones.
