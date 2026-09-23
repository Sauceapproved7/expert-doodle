import {mkdir, readFile, readdir, writeFile} from "node:fs/promises";
import {join} from "node:path";

const KINDS = new Set(["datasets", "jobs", "checkpoints", "suites", "evaluations", "activations"]);
const IDENT = /^[a-z][a-z0-9-]{1,63}$/;

export class TrainingEvidenceStore {
  constructor(root) {
    if (!root) throw new TypeError("root is required");
    this.root = root;
  }

  path(kind, id) {
    if (!KINDS.has(kind)) throw new TypeError("unsupported evidence kind: " + kind);
    if (!IDENT.test(id)) throw new TypeError("invalid evidence id");
    return join(this.root, kind, id + ".json");
  }

  async save(kind, id, record) {
    const path = this.path(kind, id);
    await mkdir(join(this.root, kind), {recursive: true});
    await writeFile(path, JSON.stringify(record, null, 2) + "\n", {encoding: "utf8", flag: "wx"});
    return structuredClone(record);
  }

  async get(kind, id) {
    return JSON.parse(await readFile(this.path(kind, id), "utf8"));
  }

  async list(kind) {
    if (!KINDS.has(kind)) throw new TypeError("unsupported evidence kind: " + kind);
    const dir = join(this.root, kind);
    try {
      const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
      return Promise.all(names.map((name) => readFile(join(dir, name), "utf8").then(JSON.parse)));
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }
}
