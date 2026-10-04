import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";

test("Hercules AI main module remains Python syntax-valid", () => {
  const candidates = process.env.PYTHON
    ? [process.env.PYTHON]
    : ["python3", "python"];
  let result = null;

  for (const executable of candidates) {
    result = spawnSync(
      executable,
      ["-m", "py_compile", "hercules-ai/app/main.py"],
      {encoding: "utf8"},
    );
    if (!result.error || result.error.code !== "ENOENT") break;
  }

  assert.ok(result, "Python syntax compiler was not invoked");
  assert.equal(
    result.error?.code ?? null,
    null,
    result.error?.message ?? "Python syntax compiler failed to start",
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
