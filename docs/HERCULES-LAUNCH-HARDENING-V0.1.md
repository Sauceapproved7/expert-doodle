# Hercules Launch Hardening v0.1

Launch Hardening converts production-readiness evidence into a fail-closed launch decision.

Required evidence categories:
- security scan
- tenant isolation
- authorization boundary
- idempotency
- rate limits
- integrity/tamper detection
- recovery drill
- dependency-failure behavior
- observability
- backup/restore
- performance
- deployment rollback

Every required control must have status VERIFIED and a SHA-256 evidence binding.

## Boundary

This module does not manufacture evidence and does not turn a passing unit test into a production claim. It only evaluates supplied launch evidence. Missing, failed, or malformed evidence produces NOT_READY.

The gate is intentionally stricter than ordinary CI: production launch remains blocked until every required category has evidence.
