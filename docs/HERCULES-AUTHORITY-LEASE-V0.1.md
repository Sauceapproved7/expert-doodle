# Hercules Authority Lease v0.1

Authority Lease is a provider-neutral evidence object that records a temporary, job-scoped authority ceiling.

It binds:
- subject identity
- intent identifier
- authorization evidence SHA-256
- allowed resources
- allowed actions
- maximum declared impact
- validity window
- deterministic integrity digest

## Safety boundary

A lease is evidence, not credentials and not provider permission.

It never:
- carries secrets or credentials
- authenticates to an external provider
- grants provider permissions
- delegates authority
- expands the supplied authorization
- executes an action

`executionAuthority` is always false.

Evaluation fails closed for expired or not-yet-valid leases, resources/actions outside scope, invalid integrity, and requested impact above the declared ceiling.

The external execution boundary still has to validate real provider authorization and approval before acting.
