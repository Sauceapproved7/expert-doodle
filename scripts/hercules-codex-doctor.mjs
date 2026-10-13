#!/usr/bin/env node
import { lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { REQUIRED_PATHS, inspectReadiness } from '../hercules-runtime/codex-readiness.mjs';

function usage() {
  return 'Usage: node scripts/hercules-codex-doctor.mjs [--json] [--changed path1 path2 ...]\n';
}

const argumentsList = process.argv.slice(2);
const args = { json: false, paths: [] };
let changed = false;
for (const arg of argumentsList) {
  if (arg === '--json' && !changed) args.json = true;
  else if (arg === '--changed' && !changed) changed = true;
  else if (changed && !arg.startsWith('--')) args.paths.push(arg);
  else {
    process.stderr.write('Unsupported option: ' + arg + '\n' + usage());
    process.exit(2);
  }
}
if (changed && args.paths.length === 0) {
  process.stderr.write('Unsupported option: --changed needs one or more relative paths\n' + usage());
  process.exit(2);
}

const files = Object.fromEntries(REQUIRED_PATHS.map((path) => {
  try { return [path, lstatSync(resolve(process.cwd(), path)).isFile()]; }
  catch { return [path, false]; }
}));
const report = inspectReadiness({ files, nodeVersion: process.versions.node, requestedPaths: args.paths });
if (args.json) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  process.stdout.write('Hercules Codex Doctor\nLocal prerequisites: ' + report.local.status + '\n');
  process.stdout.write('Cloud/connector status: ' + report.remote.status + ' (not measurable here)\n');
  process.stdout.write('Security and test suite: ' + report.checks.status + '\n');
  process.stdout.write('Proposed-file risk: ' + report.proposedChanges.status + ' (advisory, no authorization)\n');
  if (report.local.missingPaths.length) process.stdout.write('Missing markers: ' + report.local.missingPaths.join(', ') + '\n');
  process.stdout.write('Run existing repository preflight separately: ' + report.checks.command + '\n');
}
if (report.local.status === 'blocked' || report.proposedChanges.status === 'blocked') process.exitCode = 1;
