const FORBIDDEN = new Set([
  'disable-safety',
  'bypass-auth',
  'exfiltrate-secrets',
  'self-grant-permissions',
  'erase-audit-log'
]);

export function classifyCommand(input={}) {
  const verb=String(input.verb||'').trim().toLowerCase();
  const target=String(input.target||'').trim().toLowerCase();
  const mutates=Boolean(input.mutates);
  const irreversible=Boolean(input.irreversible);
  let risk='read';
  if (mutates) risk='write';
  if (irreversible) risk='irreversible';
  if (FORBIDDEN.has(verb)) risk='forbidden';
  return {verb,target,mutates,irreversible,risk};
}

export function authorizeCommand(command, context={}) {
  if (context.killSwitch) return {decision:'deny',reason:'kill-switch-active'};
  if (!command?.verb) return {decision:'deny',reason:'invalid-command'};
  if (command.risk==='forbidden') return {decision:'deny',reason:'capability-forbidden'};
  if ((command.risk==='write'||command.risk==='irreversible') && !context.ownerApproved) {
    return {decision:'hold',reason:'owner-approval-required'};
  }
  return {decision:'allow',reason:'policy-satisfied'};
}

export function createReceipt(command, authorization, options={}) {
  return Object.freeze({
    receiptVersion:1,
    timestamp: options.now || new Date().toISOString(),
    command:Object.freeze({...command}),
    authorization:Object.freeze({...authorization})
  });
}
