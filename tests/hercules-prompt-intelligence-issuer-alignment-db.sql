-- Assert that issuance is ahead of all durable replay claims.
DO $test$
DECLARE
  v_before bigint;
  v_next bigint;
BEGIN
  SELECT last_issued INTO v_before FROM public.hercules_prompt_trace_emit_counters WHERE source='smallz';
  IF v_before < (SELECT last_sequence FROM public.hercules_prompt_trace_replay_counters WHERE source='smallz') THEN
    RAISE EXCEPTION 'issuer_still_behind_replay';
  END IF;
  v_next := public.hercules_prompt_trace_reserve_sequence('smallz');
  IF v_next <= (SELECT last_sequence FROM public.hercules_prompt_trace_replay_counters WHERE source='smallz') THEN
    RAISE EXCEPTION 'issuer_reserved_historical_claim';
  END IF;
  IF NOT public.hercules_prompt_trace_claim_sequence('smallz',v_next) THEN
    RAISE EXCEPTION 'aligned_sequence_rejected';
  END IF;
  IF public.hercules_prompt_trace_claim_sequence('smallz',v_next) THEN
    RAISE EXCEPTION 'aligned_sequence_replay_accepted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.hercules_prompt_trace_emit_counters WHERE source='window_worker') THEN
    RAISE EXCEPTION 'historical_source_not_backfilled';
  END IF;
END $test$;

-- Migration is idempotent and does not move counters backward.
BEGIN;
INSERT INTO public.hercules_prompt_trace_emit_counters AS emit(source,last_issued)
SELECT source,last_sequence FROM public.hercules_prompt_trace_replay_counters
ON CONFLICT(source) DO UPDATE
  SET last_issued=GREATEST(emit.last_issued,EXCLUDED.last_issued);
ROLLBACK;
