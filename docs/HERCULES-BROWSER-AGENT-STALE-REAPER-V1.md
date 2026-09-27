# Hercules Browser Agent Stale Reaper v1

Date: 2026-09-27 UTC

## Purpose

Prevent Browser Agent runs from remaining permanently in `running` when an Edge runtime terminates after downstream browser or planner latency.

## Rule

Every five minutes Hercules marks a Browser Agent run failed when all of the following are true:

- status is `running`;
- `completed_at` is still null;
- the run has not updated for more than five minutes.

The terminal reason is `stale_runtime_timeout`.

Existing steps and results are preserved. A compact `reaped` marker and timestamp are added to the result JSON.

## Safety

The reaper does not alter succeeded, blocked, or already failed runs.

It cannot execute browser actions and has no credential access. The function is service-role only.
