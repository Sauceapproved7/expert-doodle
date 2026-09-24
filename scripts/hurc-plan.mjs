import {readFile} from "node:fs/promises";
import {buildHurcDeploymentPlan} from "../hercules-hurc/deployment-plan.mjs";

const requestPath = process.argv[2];
if (!requestPath) {
  console.error("usage: node scripts/hurc-plan.mjs <deployment-request.json>");
  process.exitCode = 2;
} else {
  try {
    const request = JSON.parse(await readFile(requestPath, "utf8"));
    const plan = buildHurcDeploymentPlan(request);
    console.log(JSON.stringify(plan, null, 2));
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  }
}
