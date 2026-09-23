export class ForgeInterpreter {
  async interpret() {
    throw new Error("ForgeInterpreter.interpret must be implemented by a replaceable adapter");
  }
}

export class StaticForgeInterpreter extends ForgeInterpreter {
  constructor(spec) {
    super();
    this.spec = spec;
  }

  async interpret() {
    return structuredClone(this.spec);
  }
}
