# Abyss runtime setup

The operator stays mutation-locked until its owner identity, independent stop control, audit state, and recovery verification key are configured.

## 1. Configure owner identity

In the Smallz app host, set:

- `SUPABASE_PUBLIC_URL`: the existing Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY`: that project's publishable key.
- `HERCULES_OWNER_USER_ID`: the exact UUID of the authorized owner account.

The server validates each bearer session against Supabase Auth and compares the returned user UUID to `HERCULES_OWNER_USER_ID`. A bearer-shaped string or a different signed-in user is rejected.

## 2. Install the external stop control

Apply `supabase/migrations/20261003000000_hercules_abyss_control.sql` to the intended project and deploy `supabase/functions/hercules-abyss-control/index.ts` as `hercules-abyss-control`.

Set the Edge Function secret `HERCULES_ABYSS_OWNER_USER_ID` to the same owner UUID. Supabase supplies the function's `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; keep the service role key inside Supabase and never copy it into the Smallz host.

The control row starts with the emergency stop active. Resume is accepted only for the authenticated owner and only while the event hash chain verifies. If the function, database, identity check, or audit check is unavailable, mutation and resume requests fail closed. The stop endpoint still stops the current Smallz session locally if the external service is unavailable.

## 3. Configure the recovery verification key

On a trusted owner workstation, generate an Ed25519 signing key pair. Keep the private key offline or in a signing service. Set only the public key PEM and matching key ID in the Smallz host:

- `HERCULES_ABYSS_RECOVERY_PUBLIC_KEY`
- `HERCULES_ABYSS_RECOVERY_KEY_ID`

The verifier accepts a signed manifest with these fields: `algorithm`, `digest`, `expiresAt`, `issuedAt`, `keyId`, and `knownGood`. Sign the UTF-8 JSON encoding of those fields with keys in lexicographic order; `algorithm` must be `Ed25519`, `knownGood` must be `true`, `digest` must be a lowercase SHA-256 hex digest, and the validity window must be positive and no longer than 24 hours. Encode the detached signature as base64url.

The `/api/recovery/verify` route verifies manifest eligibility only. A separate recovery executor must fetch the artifact, recompute its digest, bind it to this verified manifest, and require its own authorization before restoring anything.

## Security boundary

The stop database is outside the Smallz process and its event chain detects ordinary record changes or truncation against the stored head. It is not an independently anchored hardware root of trust. Do not describe the code as production-ready until the migration and function are deployed, the owner UUID and public verification key are set, and a maintainer validates the deployed integration.
