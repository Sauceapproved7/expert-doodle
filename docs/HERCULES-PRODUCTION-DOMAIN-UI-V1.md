# Hercules Production Domain UI v1

Date: 2026-09-27 UTC

The Hercules Integrations surface now carries the production-domain launch workflow for `sauceapproved.com`.

The owner still performs only the unavoidable registrar credential authorization: create a Spaceship API credential with `dnsrecords:read` and `dnsrecords:write`, then enter its key and one-time secret into the secure Hercules Integrations fields.

After the credential is saved, the page automatically continues into the existing Hercules production DNS reconciliation. It polls the provider result and refreshes live launch status. The owner does not need to manually copy A, AAAA, or CNAME records.

The reconciliation remains fail-closed. It preserves unrelated records and refuses provider-managed or unknown conflicting records. Final Shopify domain attachment, SSL verification, and primary-domain promotion are still gated on the custom domain being recognized and healthy in Shopify.
