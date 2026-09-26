import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration = await readFile(
  new URL("../hercules-chat/sql/backend-v1.sql", import.meta.url),
  "utf8",
);
const edge = await readFile(
  new URL("../hercules-chat/hercules-chat-edge.ts", import.meta.url),
  "utf8",
);

test("chat backend enforces user ownership with RLS and composite ownership keys", () => {
  assert.match(migration, /hercules_chat_sessions[\s\S]*unique\s*\(id,\s*user_id\)/i);
  assert.match(migration, /foreign key\s*\(session_id,\s*user_id\)[\s\S]*references public\.hercules_chat_sessions\s*\(id,\s*user_id\)/i);
  assert.match(migration, /alter table public\.hercules_chat_sessions enable row level security/i);
  assert.match(migration, /alter table public\.hercules_chat_messages enable row level security/i);
  assert.match(migration, /\(select auth\.uid\(\)\)\s*=\s*user_id/i);
});

test("authenticated clients cannot forge assistant messages or private accounting", () => {
  assert.match(migration, /grant insert \(session_id, parent_message_id, role, content, client_message_id, metadata\)[\s\S]*to authenticated/i);
  assert.match(migration, /role\s*=\s*'user'/i);
  assert.match(migration, /revoke all on table private\.hercules_usage_ledger from anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.hercules_chat_reserve_ai_request[\s\S]*to service_role/i);
});

test("AI reservation rejects sessions outside the supplied user boundary", () => {
  assert.match(migration, /SESSION_NOT_OWNED_BY_USER/);
  assert.match(migration, /where s\.id = p_session_id[\s\S]*s\.user_id = p_user_id/i);
});

test("semantic memory is owner-scoped and vector indexed", () => {
  assert.match(migration, /embedding extensions\.vector\(384\)/i);
  assert.match(migration, /using hnsw \(embedding vector_cosine_ops\)/i);
  assert.match(migration, /hercules_match_chat_memories/i);
  assert.match(migration, /m\.user_id\s*=\s*\(select auth\.uid\(\)\)/i);
});

test("edge ingress requires JWT and keeps privileged credentials server-side", () => {
  assert.match(edge, /Authorization/);
  assert.match(edge, /decodeJwtSub/);
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edge, /action === "run_chat"/);
  assert.match(edge, /hercules_chat_reserve_ai_request/);
  assert.match(edge, /hercules_chat_finalize_ai_request/);
  assert.match(edge, /x-hercules-internal-key/);
  assert.doesNotMatch(edge, /service[_-]?role[^\n]*console\.log/i);
});

test("chat API bounds user-controlled payloads and metadata", () => {
  assert.match(edge, /262_144/);
  assert.match(edge, /12_000/);
  assert.match(edge, /32_000/);
  assert.match(edge, /boundedInt/);
});
