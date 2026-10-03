import {createDeployControl} from "./deploy-control.mjs";

export function createDeployerAdapter({request}={}){
 const deploy=createDeployControl({request});
 return Object.freeze({
  async ["deploy-status"]({command}) {
   return deploy.status(command?.payload?.deploymentId);
  },
  async ["deploy-release"]({command}) {
   return deploy.release(command?.payload);
  },
  async ["deploy-rollback"]({command}) {
   return deploy.rollback(command?.payload?.deploymentId);
  }
 });
}
