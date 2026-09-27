# Hercules Release Gate v1

Linear: DA-18  
Canonical repository: `Sauceapproved7/expert-doodle`

## Purpose

This is the permanent fail-closed release contract for Hercules. It does not deploy, approve, sign, purchase, open registration, or mutate production. It evaluates evidence and returns either **eligible for public release** or a concrete blocker list.

The machine-readable source of truth is `governance/hercules-release-gate-v1.json`. The evaluator is `scripts/hercules-release-gate.mjs`.

## Release sequence

1. **Build integrity**
   - owner-code gate passes;
   - provenance gate passes;
   - workflow syntax passes;
   - release-target tests pass.
2. **Security**
   - security baseline passes;
   - CodeQL passes;
   - production auth hardening is verified.
3. **Deployment**
   - production release is signed/attested;
   - production deployment is verified;
   - critical service health is green;
   - no critical incidents remain open.
4. **Rollback**
   - a verified rollback path exists for the release.
5. **Smoke verification**
   - live storefront smoke passes;
   - checkout-path smoke passes without placing an order;
   - final first-customer journey passes.
6. **Domain**
   - intended production custom domain is present, SSL-enabled, and primary.
7. **Commercial/legal owner decisions**
   - pricing approved;
   - Terms approved;
   - Privacy approved.
8. **Explicit owner release authorization**
   - the owner separately authorizes public release.
9. **Public registration switch**
   - only after steps 1–8 pass, the existing owner-controlled `public-registration-open` mechanism may be changed through its authorized path.
10. **Post-release verification**
   - rerun the public signup/customer smoke after release and preserve evidence.

## Hard boundaries

- Missing evidence is a failure, not an implicit pass.
- A false value is a blocker.
- Commercial approvals remain owner-only.
- Public-release approval remains owner-only.
- The release evaluator never opens public registration.
- The release evaluator never changes production state.
- Documentation is not evidence of a live production result.
- Live security, deployment, domain, health, and smoke checks must be re-verified for the release being considered.

## CLI

Verify that the gate policy is internally valid and its required repository dependencies exist:

```bash
node scripts/hercules-release-gate.mjs --verify-policy
```

Evaluate a JSON evidence packet:

```bash
node scripts/hercules-release-gate.mjs --evidence /path/to/release-evidence.json
```

The process exits non-zero when any required check is missing or false.

## Current 2026-09-27 launch mapping

At the time this gate was introduced:

- build/provenance/security CI was passing;
- production runtime health was green;
- storefront and checkout-path smoke verification had passed;
- custom-domain completion was still blocked on registrar/DNS authorization;
- leaked-password protection was still a production security blocker;
- pricing, Terms, and Privacy approvals remained owner decisions;
- public registration remained intentionally held closed.

Those observations are historical evidence only. They must not be reused as proof for a later release without fresh verification.
