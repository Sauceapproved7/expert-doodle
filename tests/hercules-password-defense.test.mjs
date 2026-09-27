import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const launch = readFileSync(
  new URL("../supabase/functions/hercules-launch/index.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../supabase/migrations/20260927174200_hercules_password_defense_v1.sql", import.meta.url),
  "utf8",
);

test("Hercules signup is routed through the password defense", () => {
  assert.match(launch, /hercules-password-defense-v1/);
  assert.match(launch, /api\.pwnedpasswords\.com\/range/);
  assert.match(launch, /secure_signup/);
  assert.match(launch, /hercules_password_screening_ticket/);
  assert.doesNotMatch(
    launch,
    /authMode==="signin"\?await sb\.auth\.signInWithPassword\(\{email,password\}\):await sb\.auth\.signUp\(\{email,password\}\)/,
  );
});

test("database password writes fail closed without a screening ticket", () => {
  assert.match(migration, /hercules_password_screening_tickets/);
  assert.match(migration, /hercules_password_screening_required/);
  assert.match(migration, /before insert or update of encrypted_password on auth\.users/i);
  assert.match(migration, /grant execute on function public\.hercules_password_screening_issue[\s\S]*to service_role/i);
});

test("the public verification probe uses a compromised password that passes local strength checks", () => {
  assert.match(launch, /password_defense_probe/);
  assert.match(launch, /assessPassword\("Password123!"\)/);
  assert.match(launch, /compromised_password_rejected/);
});
