#!/usr/bin/env node
import path from "node:path";
import {inspectLaunchRunStateFile} from "./run-status.mjs";

function usage() {
  return "Usage: node hercules-video/run-status-cli.mjs --state /absolute/path/to/launch-state.json";
}

const args=process.argv.slice(2);
const index=args.indexOf("--state");
if (index<0 || !args[index+1] || !path.isAbsolute(args[index+1])) {
  console.error(usage());
  process.exitCode=2;
} else {
  try {
    const report=await inspectLaunchRunStateFile(args[index+1]);
    process.stdout.write(JSON.stringify(report,null,2)+"\n");
    if (!report.integrity.ok) process.exitCode=1;
  } catch (error) {
    process.stdout.write(JSON.stringify({
      schema:"sauceapproved.hercules.video-launch-run-status",
      version:1,
      readOnly:true,
      integrity:{ok:false,blockingError:String(error?.message || error)},
    },null,2)+"\n");
    process.exitCode=1;
  }
}
