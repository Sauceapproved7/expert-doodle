import test from "node:test";
import assert from "node:assert/strict";
import {evaluateCleanerUpdate} from "../hercules-cleaner/update-policy.mjs";

const sha = "a".repeat(40);
const digest = "b".repeat(64);

test("Cleaner update accepts only exact immutable release identity", () => {
  const result = evaluateCleanerUpdate({
    currentVersion:"1.0.0",
    candidate:{version:"1.0.1",commitSha:sha,aggregateSha256:digest,releaseClass:"early_access",checkoutEnabled:false},
    expected:{commitSha:sha,aggregateSha256:digest},
  });
  assert.deepEqual(result,{allowed:true,reason:"verified-update",rollbackVersion:"1.0.0"});
});

test("Cleaner update fails closed on mutable or mismatched identity", () => {
  for (const candidate of [
    {version:"1.0.1",commitSha:"main",aggregateSha256:digest,releaseClass:"early_access",checkoutEnabled:false},
    {version:"1.0.1",commitSha:sha,aggregateSha256:"c".repeat(64),releaseClass:"early_access",checkoutEnabled:false},
    {version:"1.0.1",commitSha:sha,aggregateSha256:digest,releaseClass:"early_access",checkoutEnabled:true},
  ]) {
    const result=evaluateCleanerUpdate({currentVersion:"1.0.0",candidate,expected:{commitSha:sha,aggregateSha256:digest}});
    assert.equal(result.allowed,false);
  }
});

test("Cleaner update refuses downgrade and same-version replacement", () => {
  for (const version of ["1.0.0","0.9.9"]) {
    const result=evaluateCleanerUpdate({
      currentVersion:"1.0.0",
      candidate:{version,commitSha:sha,aggregateSha256:digest,releaseClass:"early_access",checkoutEnabled:false},
      expected:{commitSha:sha,aggregateSha256:digest},
    });
    assert.equal(result.allowed,false);
    assert.match(result.reason,/version/);
  }
});
