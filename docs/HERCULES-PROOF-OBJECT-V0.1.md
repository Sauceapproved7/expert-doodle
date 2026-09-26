# Hercules Proof Object v0.1

A Proof Object is Hercules' portable evidence envelope for completed or proposed machine work.

It answers seven questions without trusting a status message:

1. **Intent** — what was requested?
2. **Authorization** — who authorized it, for what scope, and what evidence binds that authorization?
3. **Execution** — what did Hercules report doing?
4. **Verification** — what checks evaluated the result?
5. **Artifact** — what concrete output resulted?
6. **Ownership / provenance** — how is the result attributed?
7. **Rollback** — what known state can restore or supersede it?

The canonical object is deterministically normalized and SHA-256 bound. `verifyProofObject` recomputes that digest so mutation after issuance is detectable.

## Security boundary

A Proof Object is evidence, **not authority**. `executionAuthority` is permanently false in v0.1. Possessing or verifying a Proof Object does not grant repository, deployment, financial, identity, or external-service permissions.

## Portability

The schema is intentionally provider-neutral. Revenue Recovery, repository builds, deployments, business workflows, and future Hercules modules can emit the same envelope while keeping their domain evidence in referenced artifacts.

## v0.1 non-goals

No signing key infrastructure, blockchain, external timestamp authority, credential storage, autonomous execution, legal ownership adjudication, or claim that a digest proves the truth of an upstream assertion. The digest proves integrity of the recorded envelope.
