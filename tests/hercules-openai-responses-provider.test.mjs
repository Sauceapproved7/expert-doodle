import test from "node:test";
import assert from "node:assert/strict";
import {openAIProviderReadiness} from "../hercules-models/openai-responses-provider.mjs";

test("OpenAI provider fails closed without server credential", () => {
  assert.deepEqual(openAIProviderReadiness({}), {
    ready: false,
    provider: "openai",
    reason: "missing_credential"
  });
});

test("OpenAI provider becomes ready from server environment without exposing credential", () => {
  const state=openAIProviderReadiness({
    OPENAI_API_KEY: "server-secret",
    HERCULES_OPENAI_MODEL: "gpt-5.6"
  });
  assert.deepEqual(state,{ready:true,provider:"openai",model:"gpt-5.6"});
  assert.equal(JSON.stringify(state).includes("server-secret"),false);
});
