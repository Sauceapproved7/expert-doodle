# Hercules Spaceship Owner Handoff UI v1

Date: 2026-09-27 UTC

The secure Hercules Integrations page now includes a direct link to the Spaceship API Manager next to the registrar credential fields.

The owner-only step is intentionally narrow:

1. open Spaceship API Manager;
2. create/authorize an API key with only `dnsrecords:read` and `dnsrecords:write`;
3. return to Hercules Integrations and enter the key plus one-time secret once.

After save, Hercules automatically continues into the production DNS reconciliation and result verification already deployed for `sauceapproved.com`.

The page clears both credential fields after submission. Registrar credentials are not embedded in source, written to GitHub, or returned in status output.
