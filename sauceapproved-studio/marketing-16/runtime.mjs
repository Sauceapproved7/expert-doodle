import {createMarketing16Manifest, planMarketing16Run} from "./core.mjs";

export function createMarketing16Runtime() {
  const manifest=createMarketing16Manifest();
  return Object.freeze({
    health() {
      return {
        ok:true,
        service:"hercules-marketing-16",
        version:"1",
        modules:manifest.modules.length,
        executionPolicy:manifest.executionPolicy,
        autoPublish:manifest.autoPublish,
        autoSpend:manifest.autoSpend,
        storefrontMutation:manifest.storefrontMutation
      };
    },
    manifest() {
      return structuredClone(manifest);
    },
    plan(input) {
      return planMarketing16Run(input);
    },
    execute(operation,input) {
      if (operation==="health") return this.health();
      if (operation==="manifest") return this.manifest();
      if (operation==="plan") return this.plan(input);
      throw new Error("marketing_operation_not_allowed");
    }
  });
}
