import {validateModelManifest} from "./schema.mjs";

export class HerculesModelRegistry {
  #models = new Map();

  constructor(models = []) {
    for (const model of models) this.register(model);
  }

  register(input) {
    const {ok, errors, model} = validateModelManifest(input);
    if (!ok) throw new TypeError("invalid model manifest: " + errors.join("; "));
    if (this.#models.has(model.id)) throw new Error("duplicate model id: " + model.id);
    this.#models.set(model.id, Object.freeze(structuredClone(model)));
    return this.get(model.id);
  }

  get(id) {
    const model = this.#models.get(id);
    return model ? structuredClone(model) : null;
  }

  require(id) {
    const model = this.get(id);
    if (!model) throw new Error("unknown model: " + id);
    return model;
  }

  list({task = null, state = null, origin = null} = {}) {
    return [...this.#models.values()]
      .filter((model) => !task || model.tasks.includes(task))
      .filter((model) => !state || model.state === state)
      .filter((model) => !origin || model.origin === origin)
      .map((model) => structuredClone(model));
  }
}
