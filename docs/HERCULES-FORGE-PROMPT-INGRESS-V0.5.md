# Hercules Forge Prompt Ingress v0.5

## Purpose

v0.5 adds a natural-language entry boundary without making any model provider the owner of Forge.

A prompt interpreter may propose a Forge spec. The existing Forge validator, compiler, workspace, artifact verifier, control API, and release path remain authoritative.

## Owned prompt protocol

Forge sends an interpreter request shaped as:

    {
      "protocol": "hercules-forge-interpreter/0.1",
      "prompt": "...",
      "output": "forge-spec",
      "specVersion": "0.1"
    }

The endpoint returns either a Forge spec object or:

    {"spec": { ... }}

No vendor SDK or vendor-specific hostname is embedded in the owned Forge runtime.

## Adapter security rules

The built-in HTTP adapter:

- accepts only http or https endpoints
- rejects credentials embedded in the endpoint URL
- refuses HTTP redirects so prompts are not silently forwarded elsewhere
- applies a bounded request timeout
- caps interpreter response size before parsing
- requires valid JSON returning a Forge spec-shaped object

## Control API routes

- POST /v1/projects/from-prompt
- POST /v1/projects/:projectId/revisions/from-prompt

Prompt-created projects retain a SHA-256 hash of the prompt in project metadata for provenance without automatically storing the raw prompt itself.

## Configure an interpreter

Set:

    FORGE_INTERPRETER_URL=http://127.0.0.1:38800/interpret

Optional:

    FORGE_INTERPRETER_TOKEN=<secret>

The endpoint can be backed by a local model, a private model gateway, or another authorized model service as long as it returns the Forge spec contract.

## Authority boundary

The interpreter can propose a spec only.

It cannot:
- write workspace files directly
- create releases directly
- bypass spec validation
- bypass artifact verification
- change the canonical Forge project format

That separation keeps the Base44-style product logic in Hercules Forge source code while allowing the underlying model to be replaced.
