# Hercules Forge Owned Core v0.1

## Purpose

Hercules Forge is the SauceApproved-owned application-building layer.

The canonical builder logic lives in this repository. Hosted app builders are not runtime authorities and are not dependencies of this core.

## Ownership boundary

Hercules Forge owns:

- the application specification format
- validation rules
- project compilation
- generated source layout
- CRUD runtime generation
- database schema generation
- project fingerprints
- build evidence
- the interpreter interface
- deployment contracts added in later Forge versions

A language model may help translate natural-language intent into a Forge specification, but that model is an interchangeable interpreter behind the Forge interface. The model does not own the project format, compiler, generated runtime, or deployment policy.

Infrastructure software, language runtimes, open-source libraries, model weights, operating systems, databases, and hosting providers retain their own licenses and rights. "Owned core" means SauceApproved controls the product-specific source and can replace those components without changing the Forge product contract.

## v0.1 flow

1. Human intent or another authorized input produces a Forge JSON spec.
2. schema.mjs validates the spec and fails closed.
3. compiler.mjs deterministically generates source files.
4. cli.mjs writes those files to an output directory.
5. The output carries a SHA-256 build fingerprint.

Run:

    node hercules-forge/cli.mjs path/to/spec.json forge-output

Test:

    node --test tests/hercules-forge.test.mjs

## Non-lock-in rule

The owned Forge layer must not import or require hosted builder SDKs. AI and infrastructure providers must remain behind explicit adapters. If a provider changes, Forge source, specs, and generated project contracts remain under SauceApproved control.

## Next boundary

The next safe increment is the owned workspace/runtime service:

- project persistence
- revision history
- generated-file diffing
- sandboxed build execution
- deployment adapter contract
- preview/publish lifecycle
- evidence and rollback records

That increment must extend this core rather than replace it with a hosted builder.
