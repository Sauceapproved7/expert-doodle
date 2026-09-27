# Hercules Data Rights Operations v2

**Status:** Production reviewed-fulfillment control  
**Entity:** SauceApproved enterprise LLC  
**Applies to:** Hercules Privacy Request Center

## Purpose

This runbook upgrades the request center from preview-only handling to reviewed fulfillment for access/export and deletion requests.

## Verified export

A verified `privacy_access` or `privacy_export` request can generate a JSON export package through the service-role-only fulfillment RPC.

The package includes customer-linked Hercules content, membership/usage records, and billing metadata that Hercules stores for the subject. It deliberately excludes password hashes, auth/session/refresh tokens, service credentials, and unrelated users' data.

The owner bridge requires the exact confirmation `EXPORT <reference>` before returning the package. Generation is audited. Export generation does not itself assert that delivery to the requester has occurred.

## Deletion workflow

Deletion is fail-closed and two-stage:

1. Verify the requester's identity or business authority.
2. Generate the existing scope preview.
3. Run `privacy_request_delete_plan`. This is always a dry-run.
4. Review the user-scoped, review-before-deletion, and protected classes.
5. If deletion should proceed, the owner must enter the exact owner confirmation `DELETE <reference>`.
6. The bridge marks that exact request `in_progress`, executes only the user-scoped deletion RPC, records audit evidence, and returns post-deletion verification counts.

A generic chat instruction, ticket existence, or preview does not authorize destructive execution.

## Automatically deletable user-scoped content

The executor is limited to:
- `hercules_projects`;
- `hercules_sessions`;
- `hercules_chat_sessions`;
- `hercules_chat_messages`;
- `hercules_chat_memories`;
- `hercules_chat_tool_calls`.

Deletion order is explicit so dependent chat records are removed before parent records.

## Review before deletion

These are not automatically deleted:
- `hercules_memberships`;
- `hercules_usage`;
- `hercules_usage_events`;
- `hercules_billing`.

They can affect workspace authority, accounting, entitlements, fraud/security review, contractual history, or other users and therefore require separate treatment.

## Protected by default

The automated executor does not delete:
- audit logs;
- security events;
- release attestations/evidence;
- release queues/rollouts;
- records required for tax, accounting, contractual, dispute, or legal obligations.

Protected does not mean permanent. It means retention/deletion requires a separate documented basis.

## Security boundaries

- Fulfillment RPCs are service-role-only.
- Anonymous/authenticated client roles cannot call them directly.
- Unverified requests fail closed.
- Access/export and deletion categories are enforced independently.
- Exact request references are required.
- Export and destructive execution require explicit owner confirmations.
- Actual deletion is never the default: `p_execute=false`.
- The bridge writes audit evidence without storing exported customer content in the audit log.
- Post-deletion verification reports remaining user-scoped row counts.

## Post-deletion verification

A successful execution returns counts for every automatically deletable table after deletion. The expected result is zero user-scoped rows in each listed class. Review/protected records are reported as retained rather than silently removed.
