import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const policy = JSON.parse(await readFile(
  new URL("../governance/owner-code-policy.json", import.meta.url),
  "utf8",
));
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const provenance = await readFile(new URL("../IP_PROVENANCE.md", import.meta.url), "utf8");
const threatModel = await readFile(
  new URL("../docs/HERCULES-THREAT-MODEL.md", import.meta.url),
  "utf8",
);

test("Hercules chat is inside the repository-wide owner-code runtime boundary", () => {
  const roots = new Map(policy.runtimeRoots.map((entry) => [entry.path, entry.role]));
  assert.equal(roots.get("hercules-chat"), "chat-runtime");
});

test("canonical docs identify chat as a governed runtime surface", () => {
  assert.match(readme, /hercules-chat\/.*chat/i);
  assert.match(provenance, /Chat/i);
  assert.match(threatModel, /chat/i);
  assert.match(threatModel, /memory/i);
});
