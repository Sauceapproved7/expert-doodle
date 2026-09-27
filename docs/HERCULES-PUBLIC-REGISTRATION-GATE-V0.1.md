# Hercules Public Registration Gate v0.1

Date: 2026-09-27 UTC

## Purpose

Hercules has a passing technical launch gate, but general availability is still intentionally blocked by pricing, Terms, Privacy, and authentication-hardening approvals.

Public account creation must not outrun those launch controls.

## Enforcement layers

### Product surface

The canonical `hercules-launch` source now reads the latest `hercules-launch-gate` state before offering account creation.

When `launch_ready` is false:
- existing authorized users may sign in;
- the Create account control is disabled;
- the UI states `Early access — sign-in only`;
- any stale signup-mode submission rechecks the launch gate before calling Supabase Auth.

The duplicate Wallet navigation entry was also removed as launch polish.

### Workspace bootstrap

`hercules_bootstrap_organization()` independently enforces the launch state server-side.

Before inserting a new organization, it requires one of:

1. the latest Hercules launch gate has `launch_ready=true`;
2. the authenticated user already has an active Hercules membership; or
3. the request belongs to the isolated synthetic onboarding certification account pattern.

This means a direct Auth signup cannot become a usable new public Hercules workspace while general availability is closed.

## Synthetic certification boundary

The existing launch onboarding E2E uses short-lived `hercules-onboard-...@example.com` synthetic users and deletes its test user/workspace when the run completes.

That narrow fixture path remains permitted so launch certification can continue while public registration is closed.

## Fail-closed behavior

If no launch-gate evidence exists, public registration is treated as closed.

The gate does not approve pricing, Terms, Privacy, billing, or Auth security settings. Those existing owner/evidence requirements remain unchanged.
