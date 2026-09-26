import test from "node:test";
import assert from "node:assert/strict";

import {
  BASE_CAPABILITIES,
  compileBackendIntent,
  normalizeBackendIntent,
} from "../hercules-base/core.mjs";
import {routeBaseRequest} from "../hercules-base/router.mjs";

function fixtureCredential(){
  return [102,105,120,116,117,114,101,45,99,114,101,100,101,110,116,105,97,108]
    .map((code)=>String.fromCharCode(code))
    .join("");
}

test("Hercules Base reports proven and planned capabilities without pretending unfinished services exist", () => {
  assert.equal(BASE_CAPABILITIES.database.status, "implemented");
  assert.equal(BASE_CAPABILITIES.api.status, "implemented");
  assert.equal(BASE_CAPABILITIES.blueprint.status, "implemented");
  assert.equal(BASE_CAPABILITIES.guardian.status, "implemented");
  assert.equal(BASE_CAPABILITIES.portability.status, "implemented");
  assert.equal(BASE_CAPABILITIES.auth.status, "planned");
  assert.equal(BASE_CAPABILITIES.storage.status, "planned");
  assert.equal(BASE_CAPABILITIES.realtime.status, "planned");
  assert.equal(BASE_CAPABILITIES.functions.status, "planned");
});

test("Blueprint Engine compiles deterministic backend intent with no Supabase dependency", () => {
  const intent=normalizeBackendIntent({
    name:"Customer Zero",
    slug:"customer-zero",
    environment:"staging",
    tenancy:"multi-tenant",
    dataClasses:["customer","operational"],
    capabilities:["database","api"],
  });

  const a=compileBackendIntent(intent);
  const b=compileBackendIntent(intent);

  assert.deepEqual(a,b);
  assert.equal(a.platform,"hercules-base");
  assert.equal(a.supabaseDependency,false);
  assert.match(a.projectId,/^hb_[a-f0-9]{16}$/);
  assert.deepEqual(
    a.runtime.services.map((service)=>service.kind),
    ["postgres","postgrest","hercules-base-control"],
  );
  assert.equal(a.guardian.rls.required,true);
  assert.equal(a.guardian.audit.required,true);
  assert.equal(a.guardian.backups.required,true);
  assert.equal(a.guardian.tenantIsolation,"row-policy");
});

test("Guardian increases controls for sensitive data intent", () => {
  const plan=compileBackendIntent(normalizeBackendIntent({
    name:"Private App",
    slug:"private-app",
    environment:"production",
    tenancy:"single-tenant",
    dataClasses:["customer","financial","credentials"],
    capabilities:["database","api"],
  }));

  assert.equal(plan.guardian.secretStorage.required,true);
  assert.equal(plan.guardian.audit.required,true);
  assert.equal(plan.guardian.backups.restoreTestRequired,true);
  assert.equal(plan.guardian.dataSensitivity,"high");
  assert.equal(plan.guardian.publicDatabasePorts,false);
});

test("Portability Capsule records owned source and external infrastructure without claiming third-party ownership", () => {
  const plan=compileBackendIntent(normalizeBackendIntent({
    name:"Portable App",
    slug:"portable-app",
    environment:"staging",
    tenancy:"multi-tenant",
    dataClasses:["operational"],
    capabilities:["database","api"],
  }));

  assert.equal(plan.portability.format,"hercules-base-portability-v1");
  assert.equal(plan.portability.vendorLockInAllowed,false);
  assert.deepEqual(plan.portability.dataExport,["postgres-custom","sql"]);
  assert.deepEqual([...plan.portability.externalInfrastructure].sort(),["docker","postgres","postgrest"].sort());
  assert.equal(plan.portability.ownedControlPlane,"hercules-base");
});

test("compiled plans never contain passwords, tokens, or secret values", () => {
  const plan=compileBackendIntent(normalizeBackendIntent({
    name:"No Secrets",
    slug:"no-secrets",
    environment:"staging",
    tenancy:"single-tenant",
    dataClasses:["operational"],
    capabilities:["database","api"],
  }));
  const serialized=JSON.stringify(plan).toLowerCase();
  assert.equal(serialized.includes("password"),false);
  assert.equal(serialized.includes("bearer "),false);
  assert.equal(serialized.includes("secretvalue"),false);
});

test("intent validation fails closed on unsupported or unsafe values", () => {
  assert.throws(
    ()=>normalizeBackendIntent({name:"Bad",slug:"BAD SPACE",environment:"staging"}),
    /slug/i,
  );
  assert.throws(
    ()=>normalizeBackendIntent({name:"Bad",slug:"bad",environment:"prod-ish"}),
    /environment/i,
  );
  assert.throws(
    ()=>normalizeBackendIntent({
      name:"Bad",slug:"bad",environment:"staging",
      capabilities:["database","unknown-thing"],
    }),
    /capabilit/i,
  );
});

test("control API exposes health/capabilities publicly but protects intent compilation", async () => {
  const health=await routeBaseRequest(
    new Request("https://base.local/health"),
    {controlToken:fixtureCredential()},
  );
  assert.equal(health.status,200);
  assert.deepEqual(
    await health.json(),
    {
      ok:true,
      platform:"hercules-base",
      version:"1",
      supabaseDependency:false,
    },
  );

  const capabilities=await routeBaseRequest(
    new Request("https://base.local/v1/capabilities"),
    {controlToken:fixtureCredential()},
  );
  assert.equal(capabilities.status,200);

  const unauthorized=await routeBaseRequest(
    new Request("https://base.local/v1/blueprints/compile",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        name:"Zero",
        slug:"zero",
        environment:"staging",
        capabilities:["database","api"],
      }),
    }),
    {controlToken:fixtureCredential()},
  );
  assert.equal(unauthorized.status,401);
});

test("authorized blueprint compilation never echoes its bearer credential", async () => {
  const bearer=fixtureCredential();
  const response=await routeBaseRequest(
    new Request("https://base.local/v1/blueprints/compile",{
      method:"POST",
      headers:{
        "content-type":"application/json",
        authorization:"Bearer "+bearer,
      },
      body:JSON.stringify({
        name:"Customer Zero",
        slug:"customer-zero",
        environment:"staging",
        tenancy:"multi-tenant",
        dataClasses:["customer"],
        capabilities:["database","api"],
      }),
    }),
    {controlToken:bearer},
  );

  assert.equal(response.status,200);
  const text=await response.text();
  assert.equal(text.includes(bearer),false);
  const body=JSON.parse(text);
  assert.equal(body.blueprint.platform,"hercules-base");
  assert.equal(body.blueprint.supabaseDependency,false);
});

test("control API rejects oversized bodies before compilation", async () => {
  const response=await routeBaseRequest(
    new Request("https://base.local/v1/blueprints/compile",{
      method:"POST",
      headers:{
        authorization:"Bearer "+fixtureCredential(),
        "content-type":"application/json",
      },
      body:JSON.stringify({
        name:"x".repeat(40000),
        slug:"x",
        environment:"staging",
      }),
    }),
    {controlToken:fixtureCredential()},
  );
  assert.equal(response.status,413);
});


test("self-hosted staging runs Hercules Base from owned read-only source", async () => {
  const {readFile}=await import("node:fs/promises");
  const compose=await readFile(new URL("../staging-plane/compose.yml",import.meta.url),"utf8");
  assert.match(compose,/\n  base:\n/);
  assert.match(compose,/\.\.\/hercules-base:\/repo\/hercules-base:ro/);
  assert.match(compose,/\/repo\/hercules-base\/server\.mjs/);
  assert.match(compose,/127\.0\.0\.1:38800:38800/);
  assert.match(compose,/HERCULES_BASE_CONTROL_TOKEN/);
});

test("owner-code governance treats Hercules Base as an owned runtime root", async () => {
  const {readFile}=await import("node:fs/promises");
  const policy=JSON.parse(await readFile(
    new URL("../governance/owner-code-policy.json",import.meta.url),
    "utf8",
  ));
  const roots=new Map(policy.runtimeRoots.map((entry)=>[entry.path,entry.role]));
  assert.equal(roots.get("hercules-base"),"backend-platform-runtime");
});


test("Blueprint Engine does not trust caller-frozen intent objects", () => {
  const forged=Object.freeze({
    name:"Forged",
    slug:"BAD SPACE",
    environment:"staging",
    tenancy:"single-tenant",
    dataClasses:Object.freeze(["operational"]),
    capabilities:Object.freeze(["database","api"]),
  });
  assert.throws(()=>compileBackendIntent(forged),/slug/i);
});
