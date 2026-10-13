#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { getCloudHandoff } from '../hercules-runtime/codex-cloud-profile.mjs';

if (process.argv.slice(2).some((argument) => argument !== '--json')) {
  process.stderr.write('Unknown option. Usage: node scripts/hercules-codex-cloud-handoff.mjs [--json]\n');
  process.exit(2);
}

let data;
try {
  data = JSON.parse(readFileSync(new URL('../governance/hercules-codex-cloud-profile-v1.json', import.meta.url), 'utf8'));
} catch {
  process.stderr.write('Codex Cloud profile is missing or malformed.\n');
  process.exit(1);
}
const handoff = getCloudHandoff(data);
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(handoff, null, 2) + '\n');
} else {
  process.stdout.write('Hercules Codex Cloud — repository handoff\n');
  process.stdout.write('Setup recipe: ' + (handoff.safeToUseAsSetupText ? 'validated' : 'blocked') + '\n');
  process.stdout.write('Codex published environment: unverified — this script cannot publish it.\n');
  if (handoff.safeToUseAsSetupText) {
    process.stdout.write('\nInstall commands (run in Codex environment setup):\n');
    for (const command of handoff.installCommands) process.stdout.write('  ' + command + '\n');
    process.stdout.write('\nStartup checks (run from the repository root):\n');
    for (const command of handoff.startCommands) process.stdout.write('  ' + command + '\n');
    process.stdout.write('\n' + handoff.cloudPublishAction + '\n');
  } else {
    process.stdout.write('Profile validation blockers: ' + handoff.blockers.join(', ') + '\n');
  }
}
if (!handoff.safeToUseAsSetupText) process.exitCode = 1;
