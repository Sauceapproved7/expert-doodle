import test from "node:test";
import assert from "node:assert/strict";
import {createHerculesDeployAdaptersFromEnv} from "../hercules-deploy/service.mjs";

test("Hercules Deploy registers the native Smallz bot target without external provider credentials",()=>{
 const adapters=createHerculesDeployAdaptersFromEnv({});
 assert.equal(adapters.has("hercules_bot_local"),true);
 assert.equal(typeof adapters.get("hercules_bot_local")?.deploy,"function");
 assert.equal(typeof adapters.get("hercules_bot_local")?.verify,"function");
 assert.equal(typeof adapters.get("hercules_bot_local")?.rollback,"function");
});
