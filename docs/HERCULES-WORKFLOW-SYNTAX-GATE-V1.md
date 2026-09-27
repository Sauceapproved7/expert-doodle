# Hercules Workflow Syntax Gate v1

Date: 2026-09-27 UTC

## Problem

The Revenue Recovery workflow was red before any job started because its YAML contained literal `\\n` characters inside a `run: |` block. GitHub could not parse the workflow, so the run failed with zero jobs.

## Repair

The Revenue Recovery workflow now uses a real YAML block scalar and verifies all three recovery modules with normal multiline shell commands.

A repository-wide workflow integrity gate was added to prevent the same class of corruption from reappearing.

## Guard

`scripts/verify-workflow-files.mjs` checks every `.github/workflows/*.yml` and `.yaml` file for:

- literal `\\n` escape sequences;
- tab indentation;
- malformed `run: |\\n` block scalars;
- missing top-level `name`, `on`, or `jobs` sections.

The guard uses only Node.js standard-library modules and adds no package dependency.

## Verification

Both the dedicated Revenue Recovery workflow and the Workflow Syntax Gate run on changes to the repaired workflow or verifier. The Revenue Recovery workflow also runs on push so the repaired main-branch gate can produce a clean green run after merge.
