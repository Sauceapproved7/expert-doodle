# Hercules OpenAI Responses Provider Boundary v1

This optional adapter lets Hercules use OpenAI as external model infrastructure without replacing the embedded Hercules model plane.

## Security boundary

- The credential is read only from server-side `OPENAI_API_KEY`.
- Missing credentials fail closed; no provider request is attempted.
- Provider readiness never returns the credential.
- Output tokens are bounded.
- The default model is `gpt-5.6`; deployments may set `HERCULES_OPENAI_MODEL`.
- OpenAI remains third-party infrastructure and is not claimed as Hercules-owned technology.

## Activation

The provider can be built and tested without a credential. Production activation requires the owner-controlled deployment environment to supply `OPENAI_API_KEY`. Never commit that secret.

## Hercules differentiators

1. Fail-closed provider readiness can be inspected without probing the external provider.
2. The provider is isolated from the embedded Hercules model plane, preserving an owned core with an optional external intelligence boundary.

Customer-facing routing into this provider requires a separate reviewed integration change.
