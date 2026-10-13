/** Evidence-only Hercules Codex Cloud setup recipe. Commands are data, never executed here. */
export const COMMANDS = Object.freeze({
  install: Object.freeze(['node --version', 'node scripts/hercules-codex-doctor.mjs --json']),
  start: Object.freeze(['node --test tests/hercules-codex-doctor.test.mjs', 'node scripts/hercules-preflight.mjs']),
});

function sameItems(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((item, index) => item === expected[index]);
}

export function validateCodexCloudProfile(value) {
  const issues = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, issues: ['invalid_profile'] };
  }
  if (value.schema !== 'sauceapproved.hercules.codex-cloud-profile.v1' || value.version !== 1) {
    issues.push('invalid_schema');
  }
  if (value.repository !== 'Sauceapproved7/expert-doodle' || value.branch !== 'main') {
    issues.push('invalid_repository');
  }
  if (value.nodeMinimumMajor !== 22) issues.push('invalid_node_version');
  if (!sameItems(value.installCommands, COMMANDS.install)
      || !sameItems(value.startCommands, COMMANDS.start)) {
    issues.push('unapproved_commands');
  }
  if (value.requiresCredentials !== false || value.allowLiveDeploy !== false
      || value.allowPaymentChanges !== false || value.autoPublish !== false) {
    issues.push('unapproved_authority');
  }
  if (value.defaultNetwork !== 'minimal' || value.visibility !== 'private') {
    issues.push('unsafe_network_or_visibility');
  }
  return { ok: issues.length === 0, issues };
}

export function getCloudHandoff(profile) {
  const checked = validateCodexCloudProfile(profile);
  return {
    schema: 'sauceapproved.hercules.codex-cloud-handoff.v1',
    safeToUseAsSetupText: checked.ok,
    blockers: checked.issues,
    repository: 'Sauceapproved7/expert-doodle',
    localChecks: 'not_run',
    codexEnvironment: 'unverified',
    environmentPublished: false,
    repositoryMountedInCloudTask: 'unverified',
    cloudPublishAction: 'In Codex on web or desktop, Work in > Cloud > Create environment, select this repository, verify setup, then Publish.',
    installCommands: checked.ok ? [...COMMANDS.install] : [],
    startCommands: checked.ok ? [...COMMANDS.start] : [],
    authority: { deploy: false, commerce: false, credentials: false, cloudPublish: false },
  };
}
