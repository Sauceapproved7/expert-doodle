# Hercules security registry reader v1

Forge's operator API now offers `GET /v1/security/registry` behind the existing bearer control token. It reads the bundled v1.3.3 catalog of 21 sources. There is no outbound source retrieval, feed execution, artifact download, or catalog mutation.

Search parameters: `q` (at most 1000 characters), `limit` (1–1000, default 100), `safety`, and `trust`. Use `id` alone for an exact source plus quarantine policy. Unknown or duplicate parameters fail with 400; absent source IDs return 404. All other methods return 405 after authentication. Responses carry registry version/checksum, source count, and false execution/fetch authority.

Differentiators: loading is gated by a separately pinned SHA-256; records returned to callers are independent copies so policy cannot be altered through search results. Hazardous records are searchable metadata with explicit quarantine and no fetch permission, including intelligence feeds otherwise marked automatic in the historical catalog.

Source provenance: the snapshot is the original normalized Hercules registry metadata from v1.3.3, including source identity, links, classifications, and verification observations. It contains no copied source documents, exploit code, malicious payloads, or samples. Third-party source content and infrastructure remain third-party; freshness observations are historical and do not establish full feed coverage. Official CISA alternate URLs are retained. Catalog SHA-256: `ff0d36253fded3d809126a2d7539ae55f739adfc5609229acb3558f8e3a63eeb`.

To refresh, validate the upstream registry, review the changed metadata, replace the snapshot and pinned checksum together in a reviewed change, then run reader/API tests and repository gates. Updating the hash is a trust decision, not an automatic acceptance of arbitrary input.

Verification: `node --test tests/hercules-security-registry-reader.test.mjs tests/hercules-security-registry-api.test.mjs tests/hercules-forge-control-api.test.mjs`. Repository integration is distinct from a verified production deployment. This feature provides source-catalog search, not a full document search engine or live feed ingestion.
