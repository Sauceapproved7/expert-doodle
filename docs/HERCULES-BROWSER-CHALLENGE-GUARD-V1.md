# Hercules Browser Challenge Guard v1

Date: 2026-09-27 UTC

## Purpose

Stop Hercules Browser Agent cleanly when a website presents an anti-bot, CAPTCHA, or human-verification challenge.

## Behavior

The Browser Agent checks the current page before asking its planner for another action. Known security-verification indicators such as "Just a moment", "Performing security verification", "Verify you are human", and CAPTCHA text are classified as:

`anti_bot_verification_required`

The run is recorded as `blocked`, the browser session is closed, and no bypass attempt is made.

## Why

A verification page is not a normal page state and should not be treated as a useful title, a reason to keep waiting repeatedly, or an invitation to automate around the site's controls. This avoids wasted browser steps and produces an explicit owner-only blocker when a site requires human verification.

## Boundaries

This does not weaken any existing browser capability. It preserves the established restrictions against CAPTCHA/anti-bot bypass and high-impact autonomous actions.
