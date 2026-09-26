# Hercules Chat Backend v1

## Purpose

This component is the canonical source representation of the deployed Hercules chat backend in Supabase.

It provides:

- user-owned chat sessions and append-oriented message logs;
- RLS isolation based on Supabase Auth `auth.uid()`;
- server-only assistant, system, tool, metering, and audit writes;
- semantic memory using `gte-small` 384-dimensional embeddings and pgvector HNSW search;
- request idempotency, minute/day rate limits, usage reservations, and monthly Hercules AI-run rollups;
- Realtime publication for durable chat messages and tool-call state;
- scheduled retention cleanup;
- an authenticated `hercules-chat` Edge Function that reuses the existing internal `hercules-ai` router.

## Source

- `sql/backend-v1.sql` — idempotent database/RLS/function baseline.
- `hercules-chat-edge.ts` — source matching the deployed `hercules-chat` Edge Function.
- `../tests/hercules-chat-backend.test.mjs` — static security-contract regression tests.

## Trust boundaries

Browser/mobile clients use a normal authenticated JWT and never receive the service-role key or Hercules internal AI key.

Authenticated clients can:

- create/list/update/delete only their own sessions;
- append only `role='user'` messages to their own sessions;
- read only their own messages/tool events/memories;
- delete only their own explicit memories.

Authenticated clients cannot:

- create assistant/system/tool messages;
- set another user's ownership;
- write token/cost fields;
- write tool results;
- access the private usage/audit/rate-limit tables;
- invoke the service-only reserve/finalize RPCs.

The Edge Function is deployed with JWT verification enabled. Privileged operations occur only inside the server function.

## API actions

The `hercules-chat` function accepts POST JSON with one of:

- `create_session`
- `list_sessions`
- `update_session`
- `delete_session`
- `send_message`
- `get_messages`
- `remember`
- `search_memory`
- `forget_memory`
- `usage`
- `run_chat`

`run_chat` performs:

1. authenticated user resolution;
2. atomic request reservation/rate-limit check;
3. user-message persistence under RLS;
4. recent conversation retrieval;
5. best-effort semantic-memory retrieval;
6. internal call to the existing Hercules AI router;
7. trusted assistant-message persistence;
8. usage finalization and Hercules monthly AI-run rollup.

## Memory

Memory writes are explicit. Ordinary messages are not automatically promoted into long-term memory.

This avoids turning every conversational statement into a durable fact. Semantic search is scoped to `auth.uid()` and expired memories are filtered and cleaned.

## Accounting limitation

The current internal `hercules-ai` router does not expose provider token-usage/cost telemetry. Request counts and Hercules `ai_runs` are durable and accurate, while token and monetary fields remain zero until the router returns authoritative usage metadata.

Do not estimate or fabricate provider usage in the ledger.

## Deployment evidence

The live Supabase deployment was verified with rollback-only integration checks for:

- owner session/message creation and read;
- cross-user session/message isolation;
- rejection of authenticated assistant-message forgery;
- semantic vector-memory retrieval;
- reserve -> finalize usage lifecycle;
- monthly Hercules AI-run rollup.

The deployed Edge Function is `hercules-chat` with JWT verification enabled.
