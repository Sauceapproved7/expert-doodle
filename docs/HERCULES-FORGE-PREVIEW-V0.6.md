# Hercules Forge Preview Plane v0.6

## Purpose

v0.6 adds the first runnable Forge preview lifecycle.

A verified Forge artifact can now be started locally, viewed through a loopback preview URL, exercised through the generated CRUD API, inspected through the Forge control API, and stopped cleanly.

## Accuracy of the isolation claim

This version is a **loopback controlled process**, not a hardened container sandbox.

It provides useful preview separation by:
- verifying the artifact before execution
- launching only Forge-generated server source
- binding the generated backend to 127.0.0.1
- binding the preview frontend/proxy to 127.0.0.1
- starting the child with a small allowlisted environment
- not forwarding control API authorization headers or cookies to the preview backend
- capping proxied request bodies
- serving the preview HTML with restrictive browser security headers

It does not claim kernel, VM, container, seccomp, namespace, or network-egress isolation. If Forge later accepts arbitrary customer-written server code, a stronger container or VM execution boundary is required before calling that execution a hardened sandbox.

## Control API

Start a preview:

    POST /v1/projects/:projectId/revisions/:revisionId/preview

Inspect it:

    GET /v1/projects/:projectId/preview

Stop it:

    DELETE /v1/projects/:projectId/preview

Starting a new preview for the same project stops the previous one first.

## Generated-app hardening

The v0.6 compiler also:
- escapes generated HTML text
- caps generated JSON request bodies at 1 MiB
- maps malformed JSON to HTTP 400
- binds generated servers to 127.0.0.1 by default
- prevents POST bodies from overriding generated record IDs
- suppresses unexpected internal error details
- emits an IPC-ready message used by the owned preview runner

## Ownership boundary

The compiler, artifact verification, preview runner, proxy, lifecycle manager, control routes, and generated-runtime defaults are canonical Hercules Forge source.

The next customer-facing layer can consume these APIs without handing canonical project state or preview orchestration to a hosted app-builder platform.
