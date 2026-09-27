# Hercules Data Rights Operations v1

**Status:** Preview-only production control  
**Entity:** SauceApproved enterprise LLC  
**Applies to:** Hercules Privacy Request Center

## Purpose

This runbook defines the first operational data-rights workflow for access, export, correction, and deletion requests.

The v1 control is intentionally **preview-only**. It inventories customer-linked records and classifies them before any irreversible action. It does not delete customer data.

## Workflow

1. A requester submits a ticket through the Hercules Privacy Request Center.
2. The ticket starts with `requester_verified=false`.
3. An authenticated Hercules owner reviews the request.
4. Identity or business authority is verified through an appropriate method.
5. The owner records that verification with an explicit `VERIFY <reference>` confirmation.
6. Hercules generates a data-rights preview.
7. The preview separates:
   - user-scoped content;
   - records requiring review before deletion;
   - protected audit/security/release evidence.
8. Export or deletion execution requires a later, separate implementation and explicit owner approval for that verified request.

## User-scoped content

The preview counts customer-linked content in:
- `hercules_projects`;
- `hercules_sessions`;
- `hercules_chat_sessions`;
- `hercules_chat_messages`;
- `hercules_chat_memories`;
- `hercules_chat_tool_calls`.

These records are candidates for export and, where lawful and technically safe, deletion.

## Review before deletion

The preview separately counts:
- workspace memberships;
- usage records;
- usage events;
- billing metadata.

These records can affect other workspace members, accounting, entitlements, fraud/security review, or contractual history. They are not automatically deletable.

## Protected by default

The preview labels these classes as protected pending policy/legal review:
- audit log evidence;
- security events;
- release attestations and release evidence;
- records required for tax, accounting, contractual, dispute, or legal obligations.

Protected does not mean retained forever. It means Hercules will not remove them through an automated customer-data deletion without a defined retention basis and an approved execution plan.

## Security boundaries

- Preview RPC is service-role-only.
- Anonymous and authenticated client roles cannot call it directly.
- An unverified ticket is rejected by the preview.
- A missing Hercules account is reported as `subject_not_found`; Hercules does not guess an identity.
- The preview returns counts/classification, not a bulk data export.
- The preview contains no `DELETE` operation.
- Actual deletion remains an irreversible high-impact action requiring explicit owner approval and independent verification.

## Next phase

Before Privacy launch approval:
- implement/export a reviewed customer-data package;
- define retention treatment for review/protected classes;
- implement a deletion executor with dry-run, exact request binding, explicit owner approval, audit evidence, and post-deletion verification;
- document applicable launch-market rights/disclosures.
