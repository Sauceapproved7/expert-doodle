# Hercules Forge AI Prompt Ingress v1

## Purpose

This milestone connects the production Hercules Forge control plane to the existing Hercules AI router without making any model provider authoritative over Forge.

The AI layer may propose a Forge specification. Forge still owns validation, immutable revision creation, compilation, preview, audit, durable state, artifact verification, release admission, and rollback.

## Production mode

Production can enable the internal Hercules AI adapter with:

```
FORGE_INTERPRETER_MODE=hercules-ai
FORGE_INTERPRETER_URL=https://<hercules-project>/functions/v1/hercules-ai
FORGE_INTERPRETER_TOKEN=<server-only Hercules internal service credential>
```

The token is server-side only and is never included in the public production summary.

The existing generic HTTP interpreter remains available as a replaceable portability adapter. If an interpreter URL is configured without an explicit mode, Forge preserves the existing `http` behavior.

## Hercules AI contract

Forge sends a server-to-server request to the Hercules AI router:

```json
{
  "action": "route_internal",
  "system": "<strict Forge spec contract>",
  "prompt": "<user build request>"
}
```

Authentication uses `x-hercules-internal-key` with the dedicated `forge-interpreter` service credential, not the Forge operator control token and not the broader agent-coordinator credential.

The model output must resolve to one JSON object matching Forge spec version `0.1`.

Forge accepts:
- plain JSON object text;
- one complete ```json fenced object.

Forge rejects:
- redirects;
- oversized responses;
- malformed outer responses;
- malformed model JSON;
- arrays or non-object results;
- unsupported field/page/action kinds;
- broken entity references;
- duplicate or invalid identifiers;
- specs exceeding Forge limits.

## Authority boundary

The model cannot:
- write project files directly;
- create releases;
- bypass workspace authorization;
- bypass Forge schema validation;
- bypass Proof Gate;
- bypass durable persistence;
- access the Forge control token;
- elevate a generated capability into a claim that it is live.

Only a validated Forge spec can advance into the immutable workspace/compiler pipeline.

## Proof Gate

A public Forge deployment is no longer certifiable if `/health` reports `promptIngress:false`.

Public deployment evidence now requires:
- production mode;
- matching public origin and Forge version;
- verified audit chain;
- writable working storage;
- verified remote durable state;
- active prompt ingress.

This prevents a partially wired builder UI from receiving a false ready status.

## Ownership and replaceability

The interpreter adapter, prompt contract, schema validation, and release rules are SauceApproved/Hercules repository code.

Supabase, Render, model providers, and network infrastructure remain replaceable external infrastructure and are not represented as SauceApproved-owned third-party code.


## Internal startup certification canary

Production can optionally set:

```
FORGE_STARTUP_PROMPT_CANARY_ID=forge-prompt-canary-ai-v1
```

When configured, Forge does not report a successful process startup until an internal loopback canary proves the real control-plane path:

1. authenticated project lookup;
2. `POST /v1/projects/from-prompt`;
3. Hercules AI interpretation;
4. canonical Forge spec validation;
5. immutable revision creation;
6. authenticated project reread;
7. verified durable-state readiness with at least one committed object.

The canary uses the already injected Forge control token only inside the running service. No token is written to logs or returned in the proof object.

The canary project is deliberately synthetic and tagged with `canary=forge-startup-prompt-v1` and `purpose=synthetic-production-certification`. If the configured ID already belongs to another project, startup fails closed. If the same certified canary already exists, a later restart verifies it and does not create a duplicate.

Changing the canary ID is the explicit mechanism for forcing a fresh prompt-to-project certification after a material interpreter change.
