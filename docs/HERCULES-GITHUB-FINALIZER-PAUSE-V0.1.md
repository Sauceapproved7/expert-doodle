# Hercules GitHub Finalizer Pause v0.1

Date: 2026-09-27 UTC

## Reason

The Hercules GitHub App has not been created yet, so the minute-level finalizer has nothing actionable to reconcile. Its repeated calls only return a fail-closed "App not created" response.

## Change

The `hercules-github-finalizer` cron is paused until the GitHub App setup is completed.

This does not disable:
- the direct GitHub repository connector currently used for Hercules repository work;
- the owner-facing GitHub App launcher;
- any existing repository permissions;
- current launch testing.

When the GitHub App is created and installed, the finalizer can be re-enabled as part of that setup verification.

## Launch impact

This removes known recurring operational noise without changing the launch gate or granting any additional access.
