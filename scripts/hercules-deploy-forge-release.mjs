import {deploymentRequestFromActiveForgeRelease} from "../hercules-deploy/forge-bridge.mjs";
import {HttpHerculesDeployClient} from "../hercules-deploy/client.mjs";

function required(name) {
  const value = process.env[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(name + " is required");
  return value.trim();
}

const request = await deploymentRequestFromActiveForgeRelease({
  forgeRoot: required("FORGE_ROOT"),
  projectId: required("FORGE_PROJECT_ID"),
  sourceCommit: required("FORGE_SOURCE_COMMIT"),
  publicOrigin: required("FORGE_APP_PUBLIC_ORIGIN"),
  target: {
    kind: required("HERCULES_DEPLOY_TARGET_KIND"),
    reference: required("HERCULES_DEPLOY_TARGET_REFERENCE"),
  },
  metadata: {
    source: "forge-active-release",
  },
});

const client = new HttpHerculesDeployClient({
  endpoint: required("HERCULES_DEPLOY_URL"),
  token: required("HERCULES_DEPLOY_CONTROL_TOKEN"),
});

const deployment = await client.enqueue(request, {
  deploymentId: process.env.HERCULES_DEPLOYMENT_ID || undefined,
});

console.log(JSON.stringify({
  deploymentId: deployment.deploymentId,
  status: deployment.state?.status,
  serviceId: deployment.request?.serviceId,
  releaseId: deployment.request?.releaseId,
  publicOrigin: deployment.request?.publicOrigin,
  target: deployment.request?.target,
}, null, 2));
