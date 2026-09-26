import {createHash} from "node:crypto";

const ENVIRONMENTS=new Set(["development","staging","production"]);
const TENANCIES=new Set(["single-tenant","multi-tenant"]);
const DATA_CLASSES=new Set([
  "public",
  "operational",
  "customer",
  "financial",
  "credentials",
  "regulated",
]);
const REQUESTABLE_CAPABILITIES=new Set(["database","api"]);

export const BASE_CAPABILITIES=Object.freeze({
  database:Object.freeze({
    status:"implemented",
    substrate:"postgres",
    evidence:"staging-plane/compose.yml",
  }),
  api:Object.freeze({
    status:"implemented",
    substrate:"postgrest",
    evidence:"staging-plane/compose.yml",
  }),
  blueprint:Object.freeze({
    status:"implemented",
    substrate:"hercules-owned",
    evidence:"hercules-base/core.mjs",
  }),
  guardian:Object.freeze({
    status:"implemented",
    substrate:"hercules-owned",
    evidence:"hercules-base/core.mjs",
  }),
  portability:Object.freeze({
    status:"implemented",
    substrate:"hercules-owned",
    evidence:"hercules-base/core.mjs",
  }),
  auth:Object.freeze({
    status:"implemented",
    substrate:"hercules-owned-over-postgres",
    evidence:"hercules-base/auth-router.mjs",
  }),
  storage:Object.freeze({status:"planned"}),
  realtime:Object.freeze({status:"planned"}),
  functions:Object.freeze({status:"planned"}),
});

function requiredText(value,label,{max=200}={}){
  if(typeof value!=="string")throw new TypeError(label+" is required");
  const text=value.trim();
  if(!text)throw new TypeError(label+" is required");
  if(text.length>max)throw new TypeError(label+" is too long");
  return text;
}

function uniqueSorted(values){
  return [...new Set(values)].sort();
}

function normalizeDataClasses(values){
  if(values===undefined)return ["operational"];
  if(!Array.isArray(values)||values.length===0)throw new TypeError("data classes are invalid");
  const output=[];
  for(const value of values){
    if(typeof value!=="string"||!DATA_CLASSES.has(value)){
      throw new TypeError("data class is unsupported");
    }
    output.push(value);
  }
  return uniqueSorted(output);
}

function normalizeCapabilities(values){
  if(values===undefined)return ["database","api"];
  if(!Array.isArray(values)||values.length===0)throw new TypeError("capabilities are invalid");
  const output=[];
  for(const value of values){
    if(typeof value!=="string"||!REQUESTABLE_CAPABILITIES.has(value)){
      throw new TypeError("capability is unsupported");
    }
    output.push(value);
  }
  return uniqueSorted(output);
}

export function normalizeBackendIntent(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input)){
    throw new TypeError("backend intent must be an object");
  }

  const name=requiredText(input.name,"name",{max:120});
  const slug=requiredText(input.slug,"slug",{max:63});
  if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)){
    throw new TypeError("slug must use lowercase letters, numbers, and hyphens");
  }

  const environment=input.environment??"staging";
  if(!ENVIRONMENTS.has(environment)){
    throw new TypeError("environment is unsupported");
  }

  const tenancy=input.tenancy??"single-tenant";
  if(!TENANCIES.has(tenancy)){
    throw new TypeError("tenancy is unsupported");
  }

  return Object.freeze({
    name,
    slug,
    environment,
    tenancy,
    dataClasses:Object.freeze(normalizeDataClasses(input.dataClasses)),
    capabilities:Object.freeze(normalizeCapabilities(input.capabilities)),
  });
}

function stableIntentString(intent){
  return JSON.stringify({
    name:intent.name,
    slug:intent.slug,
    environment:intent.environment,
    tenancy:intent.tenancy,
    dataClasses:[...intent.dataClasses],
    capabilities:[...intent.capabilities],
  });
}

function sensitivityFor(dataClasses){
  if(dataClasses.some((value)=>["financial","credentials","regulated"].includes(value))){
    return "high";
  }
  if(dataClasses.includes("customer"))return "moderate";
  return "standard";
}

function guardianFor(intent){
  const sensitivity=sensitivityFor(intent.dataClasses);
  return Object.freeze({
    profile:"guardian-v1",
    dataSensitivity:sensitivity,
    tenantIsolation:intent.tenancy==="multi-tenant"?"row-policy":"database-boundary",
    rls:Object.freeze({
      required:true,
      ownerPredicateRequired:intent.tenancy==="multi-tenant",
      updateWithCheckRequired:true,
    }),
    audit:Object.freeze({
      required:true,
      immutableEventIntent:true,
    }),
    backups:Object.freeze({
      required:true,
      restoreTestRequired:intent.environment!=="development",
    }),
    secretStorage:Object.freeze({
      required:sensitivity==="high"||intent.dataClasses.includes("credentials"),
      exposeToClient:false,
    }),
    publicDatabasePorts:false,
    failClosedMigrations:true,
  });
}

function runtimeFor(intent){
  return Object.freeze({
    topology:"hercules-base-v1",
    environment:intent.environment,
    services:Object.freeze([
      Object.freeze({
        kind:"postgres",
        role:"durable-data",
        ownership:"external-infrastructure",
      }),
      Object.freeze({
        kind:"postgrest",
        role:"data-api",
        ownership:"external-infrastructure",
      }),
      Object.freeze({
        kind:"hercules-base-control",
        role:"blueprint-guardian-portability",
        ownership:"hercules-owned-source",
      }),
    ]),
    requestedCapabilities:Object.freeze([...intent.capabilities]),
  });
}

function portabilityFor(){
  return Object.freeze({
    format:"hercules-base-portability-v1",
    vendorLockInAllowed:false,
    ownedControlPlane:"hercules-base",
    externalInfrastructure:Object.freeze(["docker","postgres","postgrest"]),
    dataExport:Object.freeze(["postgres-custom","sql"]),
    requiredArtifacts:Object.freeze([
      "schema",
      "migrations",
      "policy-manifest",
      "runtime-manifest",
      "backup",
      "restore-verification",
    ]),
  });
}

export function compileBackendIntent(intentInput){
  const intent=normalizeBackendIntent(intentInput);
  const digest=createHash("sha256")
    .update(stableIntentString(intent))
    .digest("hex")
    .slice(0,16);

  return Object.freeze({
    schema:"sauceapproved.hercules.base-blueprint",
    version:1,
    platform:"hercules-base",
    projectId:"hb_"+digest,
    name:intent.name,
    slug:intent.slug,
    environment:intent.environment,
    tenancy:intent.tenancy,
    dataClasses:Object.freeze([...intent.dataClasses]),
    supabaseDependency:false,
    runtime:runtimeFor(intent),
    guardian:guardianFor(intent),
    portability:portabilityFor(),
  });
}
