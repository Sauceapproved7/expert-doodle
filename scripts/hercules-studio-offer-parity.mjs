#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { witnessStudioOffer } from '../hercules-runtime/studio-offer-parity.mjs';

const usage = 'Usage: node scripts/hercules-studio-offer-parity.mjs --probe [--json]\n';
const args = process.argv.slice(2);
if (!args.includes('--probe') || args.length !== new Set(args).size || args.some(x => !['--probe', '--json'].includes(x))) {
  process.stderr.write('explicit_probe_required\n' + usage);
  process.exit(2);
}
try {
  const sourceHtml = await readFile(new URL('../hercules-forge/offers/sauceapproved-studio/index.html', import.meta.url), 'utf8');
  const report = await witnessStudioOffer({ sourceHtml });
  process.stdout.write(JSON.stringify(report, null, args.includes('--json') ? 2 : 0) + '\n');
  if (!report.exactPublicParityObserved) process.exitCode = 1;
} catch (error) {
  process.stderr.write('probe_failed:' + (error?.message === 'invalid_source_html' || error?.message === 'source_contract_not_met' ? error.message : 'error') + '\n');
  process.exitCode = 2;
}
