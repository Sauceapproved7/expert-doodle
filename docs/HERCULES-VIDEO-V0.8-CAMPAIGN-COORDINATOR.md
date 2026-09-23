# Hercules Video v0.8 — Campaign Execution Coordinator

## Purpose

The coordinator connects the existing Hercules Video stages without hiding failures or introducing a commercial fallback.

Pipeline:

**brief → storyboard → self-hosted route → render requests → tournament winners → post-audio assembly plan → final evidence package**

## Safety and ownership rules

- Only providers explicitly marked self-hosted are eligible.
- Commercial fallback is disabled.
- Every storyboard shot must have a routed render request.
- Every shot must have a tournament winner before assembly.
- Winning artifacts must be local files with SHA-256 evidence.
- Storyboard order controls final clip order even when tournament results arrive out of order.
- Post-audio strategy survives from storyboard to render requests.
- If any shot requires post-production audio, audio evidence must be supplied before final assembly.
- Final campaign evidence cryptographically links execution plan, storyboard, winning renders, assembly plan, assembly evidence, and final output.

## What v0.8 does not do

This coordinator does not itself invoke Wan2.2 or FFmpeg. Those remain behind their existing local runner boundaries.

That separation keeps orchestration deterministic and testable without requiring a GPU or media binary in CI.

## Next increment

The next step is an execution service that consumes this deterministic plan against a configured local runtime and records each state transition. The service should remain fail-closed when hardware, model checkpoint, render artifact, audio input, or final assembly evidence is unavailable.
