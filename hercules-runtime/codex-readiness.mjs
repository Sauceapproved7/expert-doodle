/**
 * Hercules Codex Doctor v1. Pure, offline, evidence-scoped inspection.
 * It neither registers cloud environments nor grants execution authority.
 */
export const REQUIRED_PATHS = Object.freeze([
  'AGENTS.md',
  'CONTRIBUTING.md',
  'governance/hercules-execution-contract-v1.json',
  'scripts/hercules-preflight.mjs',
  'scripts/verify-hercules-execution-contract.mjs',
  'scripts/security-baseline.mjs',
  'tests/hercules-implementation-enforcement.test.mjs',
]);

const GUARDED_PREFIXES = Object.freeze([
  '.github/workflows/',
  'governance/',
  'deploy/',
  'supabase/',
  'hercules-bank/',
  'hercules-hurc/',
  'hercules-authority/',
  'staging-plane/',
]);
const GUARDED_EXACT = new Set(['agents.md', 'contributing.md', 'ip_provenance.md', 'security.md']);

function classifyPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512 || /[\u0000-\u001f\u007f]/u.test(value)) {
    return { path: typeof value === 'string' ? value : null, risk: 'blocked', reason: 'invalid_path' };
  }
  const path = value.replaceAll('\\', '/');
  if (path.startsWith('/') || /^[a-z]:\//iu.test(path) || path.split('/').some((part) => part === '..' || part === '.' || part.length === 0)) {
    return { path, risk: 'blocked', reason: 'non_relative_or_traversing_path' };
  }
  const normalized = path.toLowerCase();
  const components = normalized.split('/');
  if (components.some((part) => part === '.env' || part.startsWith('.env.') || /\.(?:pem|key|p12)$/u.test(part))) {
    return { path, risk: 'review_required', reason: 'sensitive_or_secret_material' };
  }
  if (GUARDED_EXACT.has(normalized) || GUARDED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return { path, risk: 'review_required', reason: 'protected_governance_or_live_boundary' };
  }
  return { path, risk: 'isolated', reason: 'no_protected_prefix_detected' };
}

export function assessProposedPaths(values = []) {
  if (!Array.isArray(values)) {
    return { status: 'blocked', paths: [], authorizesChanges: false, reason: 'paths_must_be_an_array' };
  }
  const paths = values.map(classifyPath);
  const status = paths.some(({ risk }) => risk === 'blocked')
    ? 'blocked'
    : paths.some(({ risk }) => risk === 'review_required')
      ? 'review_required'
      : 'isolated';
  return { status, paths, authorizesChanges: false };
}

export function inspectReadiness({ files = {}, nodeVersion = '', requestedPaths = [] } = {}) {
  const major = /^([0-9]+)(?:\.|$)/u.exec(String(nodeVersion));
  const nodeSupported = Boolean(major && Number(major[1]) >= 22);
  const missingPaths = REQUIRED_PATHS.filter((path) => files[path] !== true);
  const localReady = nodeSupported && missingPaths.length === 0;
  return {
    schema: 'sauceapproved.hercules.codex-doctor.v1',
    local: {
      status: localReady ? 'prerequisites_present' : 'blocked',
      nodeSupported,
      missingPaths,
      meaning: 'File presence and Node version only. No tests were executed.',
    },
    remote: {
      status: 'unverified',
      meaning: 'Codex cloud registration, repo mounting, access, and connectivity cannot be established from local files.',
    },
    checks: { status: 'not_run', command: 'node scripts/hercules-preflight.mjs' },
    proposedChanges: assessProposedPaths(requestedPaths),
    authority: {
      productionDeployment: false,
      commerce: false,
      credentialAccess: false,
      mergeApproval: false,
    },
  };
}
