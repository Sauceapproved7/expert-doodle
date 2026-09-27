# Hercules GitHub Finalizer Cron Hygiene v0.2

Date: 2026-09-27 UTC

## Finding

The production `hercules-github-finalizer` cron is scheduled once per minute.

Before a Hercules GitHub App exists, the provider connection is only a placeholder:

- provider: `github_forge`
- repository: `Sauceapproved7/expert-doodle`
- status: `pending`
- no GitHub App private-key reference
- no App ID

The old job still attempted reconciliation every minute, producing a recurring HTTP 409 `github_app_not_created` response. The failure was correctly fail-closed, but it created unnecessary launch-time operational noise.

## Change

The finalizer cron is now event-gated from the provider-connection record.

A database trigger automatically enables the minute-level finalizer only when all reconciliation prerequisites exist:

- provider is `github_forge`;
- account is `Sauceapproved7/expert-doodle`;
- status is `pending` or `error`;
- the GitHub App private-key reference exists;
- an App ID exists in connection metadata.

Otherwise the cron remains inactive.

When reconciliation changes the connection to `active`, the same trigger idles the finalizer again.

## Behavior preserved

This does not disable the GitHub App creation flow or the launcher.

The rotating launcher can continue preparing a fresh owner-facing GitHub App setup session. When the owner completes App creation and its configuration reaches the provider-connection record, the finalizer reactivates automatically and performs the existing reconciliation/write-verification flow.

The direct GitHub repository connector used for current repository work is separate and remains operational.

## Launch impact

This is launch hygiene, not a launch-gate bypass. It removes a known recurring no-op/failure stream while preserving automatic finalization exactly when it becomes actionable.
