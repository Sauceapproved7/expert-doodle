# Hercules Retention Verification — 2026-09-27

**Status:** Verified production behavior record  
**Purpose:** Document what Hercules actually purges or preserves today without creating new legal retention periods.

## Verified automatic cleanup

Production currently performs these automatic retention actions:

- service health checks older than **30 days** are deleted by `public.hercules_ops_retention_cleanup()`;
- resolved service incidents older than **90 days** are deleted by the same cleanup function;
- private rate-limit buckets older than **2 days** are deleted by `private.hercules_chat_cleanup()`;
- private AI-run records older than **90 days** are deleted by `private.hercules_chat_cleanup()`;
- Hercules chat memories are deleted when their explicit `expires_at` timestamp has passed.

The related cron jobs are active in production. These periods describe current operational cleanup behavior only; they are not a statement that every record in Hercules uses the same retention period.

## Core customer content

There is **no blanket time-based purge** verified for projects, sessions, chat sessions, chat messages, or chat tool-call records.

Those user-scoped content classes are handled through a verified privacy request. The production data-rights executor requires requester verification and exact request binding before scoped user content can be removed.

## Review and protected classes

Hercules does not assign an invented automatic purge period to privacy requests, memberships, usage/accounting data, billing records, audit logs, security events, or release/provenance evidence.

These records require separate review because their treatment can depend on legal, tax, accounting, contractual, dispute, or security obligations. Protected or review-required does not mean retained forever; it means the automated customer-content deletion path does not silently remove them.

## Privacy-policy alignment

The current Privacy draft says Hercules keeps different data categories for different periods as reasonably necessary and does not promise one universal retention period. That wording is consistent with the verified production behavior above.

## Guardrail

This artifact is evidence, not a new retention policy. Any future change that adds a TTL, widens automated deletion, or changes a protected class must be separately implemented, tested, and reviewed before the Privacy approval evidence is refreshed.
