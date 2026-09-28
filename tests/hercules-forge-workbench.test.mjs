import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ForgeWorkspaceStore} from "../hercules-forge/workspace.mjs";
import {
  customerConsoleCss,
  customerConsoleHtml,
  customerConsoleJs,
} from "../hercules-forge/customer-console.mjs";

const spec = {
  version: "0.1",
  name: "WorkbenchFixture",
  description: "Forge workbench source-browser fixture.",
  entities: [
    {name: "Task", fields: [{name: "title", type: "string", required: true}]},
  ],
  pages: [{name: "Tasks", kind: "list", entity: "Task"}],
  actions: [{name: "CreateTask", kind: "create", entity: "Task"}],
};

test("workspace source browser reads only revision-indexed generated files", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-workbench-"));
  try {
    const store = new ForgeWorkspaceStore(root);
    const created = await store.createProject(spec, {projectId: "workbench-fixture"});
    const revisionId = created.revision.revisionId;

    const source = await store.readRevisionSource(
      "workbench-fixture",
      revisionId,
      "public/index.html",
    );

    assert.equal(source.path, "public/index.html");
    assert.equal(source.sha256, created.revision.files["public/index.html"].sha256);
    assert.equal(source.bytes, created.revision.files["public/index.html"].bytes);
    assert.match(source.content, /WorkbenchFixture/);

    await assert.rejects(
      () => store.readRevisionSource("workbench-fixture", revisionId, "../project.json"),
      /source file not found|invalid source path/i,
    );
    await assert.rejects(
      () => store.readRevisionSource("workbench-fixture", revisionId, "missing.txt"),
      /source file not found/i,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("customer console exposes the Hercules Forge workbench contract", () => {
  const html = customerConsoleHtml();
  const css = customerConsoleCss();
  const js = customerConsoleJs();

  for (const label of [
    "Files",
    "Editor",
    "Live preview",
    "Terminal / Output",
    "Hercules Agent",
    "Proof Gate",
    "Build Ledger",
  ]) {
    assert.match(html, new RegExp(label.replace("/", "\\/"), "i"));
  }

  assert.match(css, /workbench-grid/);
  assert.match(css, /editor-shell/);
  assert.match(js, /loadSourceFile/);
  assert.match(js, /\/source\?path=/);
  assert.match(js, /renderFileTree/);
  assert.match(js, /renderProofGate/);
  assert.match(js, /renderBuildLedger/);
});
