-- Executed only against a disposable PostgreSQL instance with synthetic Supabase roles.
DO $$
BEGIN
  IF NOT public.hercules_prompt_trace_claim_sequence('smallz', 1) THEN
    RAISE EXCEPTION 'initial_counter_failed';
  END IF;
  IF public.hercules_prompt_trace_claim_sequence('smallz', 1) THEN
    RAISE EXCEPTION 'duplicate_accepted';
  END IF;
  IF public.hercules_prompt_trace_claim_sequence('smallz', 0) THEN
    RAISE EXCEPTION 'invalid_sequence_accepted';
  END IF;
  IF public.hercules_prompt_trace_claim_sequence('../bad', 2) THEN
    RAISE EXCEPTION 'invalid_source_accepted';
  END IF;
  IF NOT public.hercules_prompt_trace_claim_sequence('smallz', 4) THEN
    RAISE EXCEPTION 'monotonic_advance_failed';
  END IF;
  IF public.hercules_prompt_trace_claim_sequence('smallz', 3) THEN
    RAISE EXCEPTION 'out_of_order_accepted';
  END IF;
  IF NOT public.hercules_prompt_trace_claim_sequence('another_agent', 1) THEN
    RAISE EXCEPTION 'independent_source_failed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.hercules_prompt_trace_replay_counters
             WHERE source = 'smallz' AND last_sequence <> 4) THEN
    RAISE EXCEPTION 'invalid_stored_counter';
  END IF;
  IF has_table_privilege('anon','public.hercules_prompt_trace_replay_counters','SELECT')
    OR has_table_privilege('authenticated','public.hercules_prompt_trace_replay_counters','SELECT')
    OR has_function_privilege('anon','public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE')
    OR has_function_privilege('authenticated','public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE') THEN
    RAISE EXCEPTION 'privilege_violation';
  END IF;
END;
$$;

-- Forced rollback must not advance the durable counter.
BEGIN;
SELECT public.hercules_prompt_trace_claim_sequence('smallz', 100);
ROLLBACK;

DO $$
BEGIN
  IF (SELECT last_sequence FROM public.hercules_prompt_trace_replay_counters WHERE source='smallz') <> 4 THEN
    RAISE EXCEPTION 'rollback_modified_durable_counter';
  END IF;
END;
$$;
