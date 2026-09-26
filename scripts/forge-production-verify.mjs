import {verifyForgePublicDeployment} from "../hercules-forge/deployment.mjs";

const origin = process.env.FORGE_PUBLIC_ORIGIN;
if (!origin) throw new Error("FORGE_PUBLIC_ORIGIN is required");

const evidence = await verifyForgePublicDeployment({origin});
console.log(JSON.stringify(evidence, null, 2));
