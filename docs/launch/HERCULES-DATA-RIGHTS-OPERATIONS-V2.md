# Hercules Data Rights Operations v2

**Status:** Production execution candidate  
**Entity:** SauceApproved enterprise LLC  
**Applies to:** Hercules Privacy Request Center

## Controls

The v2 workflow adds three service-role-only controls behind an authenticated Hercules owner/admin Edge Function:

1. **Verified export package** — produces an inline JSON package for verified access/export/deletion requests, capped at 5 MiB. It includes user-scoped Hercules content and excludes protected audit/security/billing-review records.
2. **Deletion plan** — returns exact row counts, preserved classes, and an exact request-bound confirmation phrase.
3. **Scoped user-content deletion** — requires a verified deletion request, an authenticated Hercules owner, and the exact `DELETE <reference>` confirmation. It blocks active owner/admin subjects.

## Deleted by the scoped executor

- Hercules projects
- Hercules sessions
- Hercules chat sessions
- Hercules chat messages
- Hercules chat memories
- Hercules chat tool calls

The executor performs post-delete row-count verification.

## Preserved for separate review

The executor intentionally does **not** delete:

- the Supabase Auth identity;
- Hercules memberships;
- usage and usage-event records;
- billing metadata;
- audit and security evidence;
- release/provenance evidence;
- records required for tax, accounting, contractual, dispute, or legal obligations.

Preserving these records is fail-closed. Their final treatment requires the applicable account, billing, retention, or legal decision rather than an automated privacy-content deletion.

## Security

- Database functions are revoked from `PUBLIC`, `anon`, and `authenticated`.
- Only `service_role` can invoke the database controls.
- The Edge Function independently authenticates the caller.
- Export and plan require owner/admin access.
- Destructive content deletion requires the `owner` role.
- Deletion is bound to one verified `privacy_deletion` request and one exact confirmation phrase.
- Active owner/admin subjects are blocked from automated deletion.
- Audit logs store action metadata, never the exported customer-data package.

## Remaining launch dependency

This closes the automatable user-content export/deletion execution gap. Final Privacy approval still depends on the live payment-provider disclosure after billing is connected and on owner/qualified approval of the final policy text.
