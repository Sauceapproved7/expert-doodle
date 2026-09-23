# Hercules Forge Builder Console v0.7

## Purpose

v0.7 adds the first owned visual Builder Console on top of the existing Hercules Forge control plane and upgrades newly generated apps from static page cards to an interactive CRUD interface.

The console is served by the Forge control API itself. It does not embed or persist the control token in source. The operator enters the token for the current browser session and privileged requests continue to go through the existing authenticated control API.

## Builder Console

The console provides:

- control API connection using an operator-supplied bearer token
- project discovery through `GET /v1/projects`
- project creation from a natural-language prompt
- project selection and revision history
- prompt-driven revision creation
- revision preview start and stop
- publishing a selected revision
- direct access to the active preview URL

The console does not bypass validation, artifact verification, preview isolation, release publication, or rollback rules.

## Generated application UI

New Forge revisions now include:

- `public/index.html`
- `public/app.css`
- `public/app.js`

The generated browser application renders each Forge entity, builds forms from the declared field schema, lists records, and calls the generated same-origin CRUD API for create, read, update, and delete operations.

Generated application data remains the responsibility of the runtime/data adapter. The current owned core server uses in-memory records for the preview/runtime fixture and the compiler continues to emit the SQL migration for a replaceable persistent data layer.

## Preview compatibility

The preview plane serves the generated `app.js` and `app.css` as exact allowlisted public assets. Older revisions that only contain `index.html` remain previewable.

Preview remains a loopback controlled process, not a hardened sandbox for arbitrary untrusted server code.

## Security boundaries

- Project operations remain authenticated.
- The Builder Console source contains no control secret.
- Generated app assets execute under same-origin CSP.
- Preview does not forward Forge control credentials to generated applications.
- Project and revision identifiers remain path-safe.
- Artifacts still require verification before preview or release.

## Owned-code boundary

The Builder Console, project discovery, generated UI compiler output, preview asset serving, artifact pipeline, release logic, and control API are repository-controlled Hercules Forge source. External model providers remain replaceable interpreter adapters and do not own the Forge project format, compiler, workspace, artifacts, releases, or Builder Console.
