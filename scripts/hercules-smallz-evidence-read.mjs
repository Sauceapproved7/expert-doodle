#!/usr/bin/env node
/**
 * Hercules Smallz read-only evidence command.
 * No custom hosts, deployment calls or owner authorization is supported.
 * Only two dedicated, already-provisioned server env tokens are read.
 */
import {runSmallzEvidenceReadCommand} from '../hercules-deploy/smallz-evidence-command.mjs';

process.exitCode=await runSmallzEvidenceReadCommand({
  argv:process.argv.slice(2),
});
