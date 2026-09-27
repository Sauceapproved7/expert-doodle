import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";

const filedLegalName="SauceApproved enterprise LLC";
const incorrectCapitalization=["SauceApproved","Enterprise","LLC"].join(" ");

test("canonical enterprise ownership record uses the filed Connecticut legal name",async()=>{
  const raw=await readFile(
    new URL("../governance/sauceapproved-enterprise-software-ownership-v1.json",import.meta.url),
    "utf8"
  );
  const record=JSON.parse(raw);
  assert.equal(record.legalEntity?.name,filedLegalName);
});

test("tracked repository files do not use the incorrect legal-entity capitalization",()=>{
  const result=spawnSync(
    "git",
    ["grep","-n","-F",incorrectCapitalization,"--","."],
    {encoding:"utf8"}
  );

  if(result.status===0){
    assert.fail(
      "Found legal-entity references that do not exactly match the filed name:\n"+
      String(result.stdout||"").trim()
    );
  }

  assert.equal(result.status,1,String(result.stderr||""));
});
