import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=(path)=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("Forge durable bridge stays private, namespaced, and content addressed", async()=>{
  const [bridge,state,migration,contentAddressed]=await Promise.all([
    read("supabase/functions/hercules-private-bridge/index.ts"),
    read("supabase/functions/hercules-private-bridge/forge-state.ts"),
    read("supabase/migrations/20260928105638_hercules_forge_durable_state_v1.sql"),
    read("supabase/migrations/20260928110300_hercules_forge_durable_state_content_addressed_v1.sql"),
  ]);

  assert.match(bridge,/handleForgeStateRequest/);
  assert.match(bridge,/isForgeStateAction/);
  assert.match(bridge,/forge_durable_state/);

  for(const action of [
    "forge_state_status",
    "forge_state_manifest",
    "forge_state_put_chunk",
    "forge_state_commit_object",
    "forge_state_get_chunk",
    "forge_state_delete_object",
  ]) assert.match(state,new RegExp(action));

  assert.match(state,/x-hercules-forge-state-key/);
  assert.match(state,/forge-durable-state/);
  assert.match(state,/object_sha256/);
  assert.match(state,/object_integrity_mismatch/);
  assert.match(state,/sha256HexBytes\(objectBytes\)/);
  assert.doesNotMatch(state,/service_role/i);

  assert.match(migration,/enable row level security/i);
  assert.match(migration,/revoke all on table public\.hercules_forge_state_objects from public, anon, authenticated/i);
  assert.match(migration,/revoke all on table public\.hercules_forge_state_chunks from public, anon, authenticated/i);
  assert.match(migration,/grant select, insert, update, delete on table public\.hercules_forge_state_objects to service_role/i);
  assert.match(migration,/vault\.create_secret/i);

  assert.match(contentAddressed,/object_sha256 text/i);
  assert.match(contentAddressed,/primary key \(path, object_sha256, chunk_index\)/i);
});
