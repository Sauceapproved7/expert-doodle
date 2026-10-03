import {createMarketing16Runtime} from "../sauceapproved-studio/marketing-16/runtime.mjs";

export function createMarketing16DeployBridge(config={}) {
  const runtime=createMarketing16Runtime(config);
  return Object.freeze({
    health() {
      return Object.freeze({...runtime.health(),deployerConnected:true});
    },
    manifest() {
      return runtime.manifest();
    },
    plan(input) {
      return runtime.plan(input);
    },
    execute(operation,input) {
      return runtime.execute(operation,input);
    }
  });
}
