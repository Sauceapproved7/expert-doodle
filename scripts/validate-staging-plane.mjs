import {readFile} from "node:fs/promises";

const files=["compose.yml","api/server.mjs","migrations/001_initialize.sql","migrations/002_seed_synthetic.sql","bin/migrate.sh","bin/backup.sh","bin/verify.sql"];
const content=Object.fromEntries(await Promise.all(files.map(async file=>[file,await readFile(new URL(`../staging-plane/${file}`,import.meta.url),"utf8")])));
const checks={
  loopbackPorts:/127\.0\.0\.1:55432/.test(content["compose.yml"])&&/127\.0\.0\.1:38080/.test(content["compose.yml"])&&/127\.0\.0\.1:38700/.test(content["compose.yml"]),
  internalNetwork:/internal: true/.test(content["compose.yml"]),
  syntheticOnly:/check \(synthetic\)/i.test(content["migrations/001_initialize.sql"])&&/@fixture\.invalid/.test(content["migrations/002_seed_synthetic.sql"]),
  rlsEnabled:(content["migrations/001_initialize.sql"].match(/enable row level security/g)||[]).length===3,
  ownerPolicies:/fixture_owner_read/.test(content["migrations/001_initialize.sql"])&&/fixture_owner_insert/.test(content["migrations/001_initialize.sql"]),
  migrationsFailClosed:/ON_ERROR_STOP=1/.test(content["bin/migrate.sh"]),
  databaseHealth:/POSTGREST_URL/.test(content["api/server.mjs"])&&/customerData:false/.test(content["api/server.mjs"]),
  recovery:/pg_dump --format=custom/.test(content["bin/backup.sh"])&&/synthetic_records_ok/.test(content["bin/verify.sql"]),
  forgeProduction:/production-cli\.mjs/.test(content["compose.yml"])&&/FORGE_PUBLIC_ORIGIN: https:\/\/forge\.staging\.invalid/.test(content["compose.yml"]),
  forgePersistent:/hercules_forge_state:\/forge-state/.test(content["compose.yml"])&&/hercules_forge_state:/.test(content["compose.yml"]),
  forgeReadOnlySource:/\.\.\/hercules-forge:\/repo\/hercules-forge:ro/.test(content["compose.yml"]),
  forgeSecretInjected:/HERCULES_FORGE_STAGING_CONTROL_TOKEN/.test(content["compose.yml"])
};
console.log(JSON.stringify({ok:Object.values(checks).every(Boolean),checks},null,2));
if(!Object.values(checks).every(Boolean))process.exitCode=1;
