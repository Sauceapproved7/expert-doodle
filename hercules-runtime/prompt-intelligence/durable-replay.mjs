const SOURCE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * A fail-closed callback for ingestBrowserTrace's claimSequence dependency.
 * rpc must be an authenticated service-role PostgREST or equivalent adapter,
 * never an end-user client and never a value supplied by browser page content.
 * DB migration supplies atomic monotonic compare-and-set across processes.
 */
export function createDurableReplayClaim({rpc} = {}) {
  if (typeof rpc !== 'function') throw new TypeError('rpc_required');
  return async (source, sequence) => {
    if (typeof source !== 'string' || !SOURCE.test(source) || !Number.isSafeInteger(sequence) || sequence < 1) {
      throw new TypeError('invalid_replay_claim');
    }
    const result = await rpc('hercules_prompt_trace_claim_sequence', {p_source:source,p_sequence:sequence});
    if (typeof result !== 'boolean') throw new Error('invalid_replay_response');
    return result;
  };
}
