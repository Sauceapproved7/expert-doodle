# Hercules GitHub Finalizer Cron Hygiene v0.1

Date: 2026-09-27 UTC

## Finding

The production `hercules-github-finalizer` cron runs once per minute.

Before a Hercules GitHub App exists, the provider connection is only a placeholder:

- provider: `github_forge`
- repository: `Sauceapproved7/expert-doodle`
- status: `pending`
- no GitHub App private-key secret
- no App ID

The old cron invoked the reconcile endpoint anyway, producing a recurring HTTP 409 `github_app_not_created` response. That response correctly protected the boundary, but the repeated request created unnecessary operational noise.

## Change

`hercules_github_finalizer_cron_tick()` now calls the reconcile endpoint only when a GitHub App is actually ready to be reconciled:

- provider is `github_forge`;
- account is `Sauceapproved7/expert-doodle`;
- status is `pending` or `error`;
- a private-key secret reference exists;
- an App ID exists in connection metadata.

If those prerequisites are absent, the cron returns `0` without making an HTTP request.

## Behavior preserved

This does not disable the GitHub App setup path.

Once the owner completes GitHub App creation and the required credentials/App ID are present, the same minute-level finalizer automatically resumes reconciliation and write verification.

The direct GitHub repository connector used for current repository work is separate and remains operational.

## Launch impact

This is launch hygiene, not a launch-gate bypass. It removes a known recurring false-action/no-op from production logs while keeping the incomplete owner-bound GitHub App setup fail-closed.
