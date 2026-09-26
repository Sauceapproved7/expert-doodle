# Hercules Consequence Envelope v0.1

A deterministic, provider-neutral evidence object for declaring bounded consequences before an action executes.

It binds: proposed action, existing authority ceiling and evidence hash, declared affected resources, impact, reversibility, uncertainty, disposition, and an integrity digest.

Impact order: NONE < RECORD < RESOURCE < SYSTEM < ORGANIZATION < EXTERNAL.

Recovery classes are ROLLBACK, COMPENSATE, and MANUAL_ONLY.

Fail-closed behavior:
- any declared effect above the supplied authority ceiling is rejected;
- unverified effects require human review;
- compensation or manual-only recovery requires human review;
- declared uncertainty requires human review;
- executionAuthority is always false.

The envelope is evidence, not permission. It cannot mint or expand authorization, execute tools, discover hidden dependencies, predict outcomes, or prove that the declared effect set is complete.

Blast-radius analysis, pre-action authorization, sandbox simulation, and rollback-aware controls already exist elsewhere. Hercules does not claim invention of those concepts. This module is the owned Hercules representation that binds declared consequence evidence to an external authority ceiling and can later be incorporated into the Hercules Proof Object chain.
