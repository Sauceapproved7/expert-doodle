## Hercules change summary

HERCULES_IMPLEMENTATION_ENFORCEMENT_V1

Describe what this pull request changes and why.

## Implementation enforcement

Required sources:
- `governance/sauceapproved-master-gpt-operating-instructions-v1.md`
- `governance/hercules-execution-contract-v1.json`
- root `AGENTS.md`

Complete every item before merge.

- [ ] Current canonical repository state inspected before changes
- [ ] Master operating instructions loaded and obeyed
- [ ] Hands-off execution default followed; routine authorized work was not pushed to the founder
- [ ] Existing equivalent implementation reused; no duplicate rebuild introduced
- [ ] Behavior changes were test-defined before implementation
- [ ] Applicable exact-head tests and CI gates pass
- [ ] `node scripts/verify-hercules-execution-contract.mjs` passes
- [ ] No fail-closed, authorization, security, provenance, owner-code, or environment boundary was weakened
- [ ] Completion claims are backed by current evidence
- [ ] Hercules Browser was used first when browser work was supported and authorized, or fallback reason is documented
- [ ] Safe independent work was completed before any owner-only blocker was raised
- [ ] Continuity with prior verified work was preserved
- [ ] Commercial quality and business-priority implications were considered
- [ ] Status reporting distinguishes changed, verified, remaining, and next-highest-value action

## Boil the Ocean closure evidence

Standard: `docs/HERCULES-BOIL-THE-OCEAN-V1.md`

- [ ] Searched current canonical implementation, previous solutions and dependencies before writing code
- [ ] All stated acceptance criteria have verifiable evidence; gaps and open threads are disclosed
- [ ] Required behavioral tests were observed failing before implementation, then passing; applicable full suite passes
- [ ] Security, failure paths, accessibility where relevant, rollback/runbook and documentation are complete
- [ ] For material builds, `node scripts/hercules-completeness-gate.mjs --manifest <path> --require-complete` passes for the scoped result
- [ ] Any deployment claim has exact-revision evidence from the live target; source-only change is not a production deployment
- [ ] If any in-scope work is unverified or blocked, the result is clearly reported as not yet complete

## Provenance attestation

- [ ] Origin documented
- [ ] License compatibility checked
- [ ] Third-party notices preserved or not applicable
- [ ] AI assistance disclosed or not applicable
- [ ] Owner-code-only build scope confirmed; no third-party code is packaged

## Canonical-source note

By merging this pull request, the resulting commit on `main` becomes the canonical repository implementation for the changed material. External drafts, chats, Drive documents, vault records, screenshots, and local copies remain supporting inputs unless separately committed.
