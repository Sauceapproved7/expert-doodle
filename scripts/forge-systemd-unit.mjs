import {renderForgeSystemdUnit} from "../hercules-forge/deployment.mjs";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + " is required");
  return value;
}

const rendered = renderForgeSystemdUnit({
  workingDirectory: required("FORGE_DEPLOY_WORKDIR"),
  forgeRoot: required("FORGE_ROOT"),
  environmentFile: process.env.FORGE_ENV_FILE ?? "/etc/hercules-forge.env",
  nodePath: process.env.FORGE_NODE_PATH ?? "/usr/bin/node",
  user: process.env.FORGE_SERVICE_USER ?? "hercules-forge",
  group: process.env.FORGE_SERVICE_GROUP ?? process.env.FORGE_SERVICE_USER ?? "hercules-forge",
});

process.stdout.write(rendered);
