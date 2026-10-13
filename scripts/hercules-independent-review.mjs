/**
 * Hercules zero-provider diff triage. Advisory static signals, not an AI review.
 * The diff is never printed, sent to a provider, or executed.
 */
import {createHash} from 'node:crypto';
import {appendFileSync, readSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const MAX_DIFF_BYTES = 2_000_000;
const MAX_FINDINGS = 100;
const RULES = Object.freeze([
  ['tls-verification-disabled', 'critical', /\bNODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0\b/],
  ['workflow-broad-permission', 'critical', /^\s*permissions\s*:\s*write-all\s*(?:#.*)?$/],
  ['dynamic-code-execution', 'warning', /\b(?:eval|Function)\s*\(/],
  ['skipped-test', 'warning', /\b(?:test|it|describe)\.skip\s*\(/],
  ['piped-shell-installer', 'warning', /\b(?:curl|wget)\b[^\n|]*\|\s*(?:bash|sh)\b/],
]);

function safePath(path) {
  return /^[A-Za-z0-9._\/-]{1,300}$/.test(path) ? path : '[untrusted-path]';
}

function sensitive(path) {
  return /^(?:\.github\/workflows\/|governance\/|hercules-authority\/|hercules-bank\/|hercules-deploy\/|shopify\/|supabase\/)/.test(path);
}

export function analyzeDiff(diff) {
  if (typeof diff !== 'string') throw new TypeError('diff must be text');
  if (Buffer.byteLength(diff, 'utf8') > MAX_DIFF_BYTES) throw new RangeError('diff exceeds limit');
  const diffSha256 = createHash('sha256').update(diff, 'utf8').digest('hex');
  const files = new Set();
  const findings = [];
  let incomplete = false;
  let truncated = false;
  let current = null;
  let newLine = 0;
  let sawHunk = false;
  let sawBinary = false;
  const addFinding = (path, line, rule, severity) => {
    if (findings.length >= MAX_FINDINGS) { truncated = true; incomplete = true; return; }
    findings.push({file: safePath(path), line, rule, severity});
  };
  const finishSection = () => {
    if (current !== null && !sawHunk && !sawBinary) {
      incomplete = true;
      addFinding(current, 0, 'non-text-change-uninspected', 'notice');
    }
  };
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      finishSection();
      const m = /^diff --git a\/(.+) b\/(.+)$/.exec(raw);
      current = m ? safePath(m[2]) : '[untrusted-path]';
      if (current === '[untrusted-path]') incomplete = true;
      files.add(current);
      if (sensitive(current)) addFinding(current, 0, 'sensitive-surface-review', 'notice');
      sawHunk = false;
      sawBinary = false;
      newLine = 0;
      continue;
    }
    if (current === null) continue;
    if (raw.startsWith('Binary files ') || raw.startsWith('GIT binary patch')) {
      incomplete = true;
      sawBinary = true;
      addFinding(current, 0, 'binary-not-reviewed', 'notice');
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) { newLine = Number(hunk[1]); sawHunk = true; continue; }
    if (!sawHunk) continue;
    if (raw.startsWith('+++ ') || raw.startsWith('--- ')) continue;
    if (raw.startsWith('+')) {
      const added = raw.slice(1);
      for (const [rule, severity, pattern] of RULES) {
        if (pattern.test(added)) addFinding(current, newLine, rule, severity);
      }
      newLine += 1;
    } else if (raw.startsWith(' ')) {
      newLine += 1;
    }
  }
  finishSection();
  return {
    schema: 'hercules.independent-review.v1',
    engine: 'deterministic-offline',
    modelReview: false,
    externalRequests: 0,
    status: incomplete ? 'incomplete' : (files.size ? 'reviewed' : 'no_changes'),
    diffSha256,
    filesReviewed: files.size,
    findings,
    findingsTruncated: truncated,
  };
}

function readBoundedStdin() {
  const buffer = Buffer.alloc(64 * 1024);
  const parts = [];
  let bytes = 0;
  while (true) {
    const count = readSync(0, buffer, 0, buffer.length, null);
    if (!count) break;
    bytes += count;
    if (bytes > MAX_DIFF_BYTES) throw new RangeError('diff exceeds limit');
    parts.push(Buffer.from(buffer.subarray(0, count)));
  }
  return Buffer.concat(parts).toString('utf8');
}

function reportSummary(report) {
  const lines = [
    '## Hercules Independent Diff Triage',
    '',
    `**Status:** ${report.status}; **files:** ${report.filesReviewed}; **findings:** ${report.findings.length}`,
    `**Diff SHA-256:** \`${report.diffSha256}\``,
    '',
    'Deterministic static triage only; not an AI or comprehensive security review. No model API, key, code execution, or outbound diff transport.',
    '',
  ];
  for (const f of report.findings) {
    lines.push(`- **${f.severity}** \`${f.rule}\` at \`${f.file}:${f.line}\``);
  }
  if (report.status === 'incomplete') lines.push('', '**Manual review required:** some evidence could not be inspected completely.');
  return lines.join('\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const base = process.env.HERCULES_REVIEW_BASE_SHA || '';
    if (!/^[a-f0-9]{40}$|^[a-f0-9]{64}$/.test(base)) throw new Error('missing verified base SHA');
    const diff = readBoundedStdin();
    const report = analyzeDiff(diff);
    console.log(JSON.stringify(report, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, reportSummary(report), 'utf8');
  } catch {
    console.error(JSON.stringify({ok: false, code: 'independent_review_unavailable'}));
    process.exitCode = 1;
  }
}
