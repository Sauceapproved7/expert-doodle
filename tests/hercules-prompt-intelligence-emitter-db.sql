-- Disposable PostgreSQL tests for the trusted Smallz sequence allocator.
DO $assert$
DECLARE
  first bigint;
  second bigint;
  other bigint;
BEGIN
  first := public.hercules_prompt_trace_reserve_sequence('smallz');
  second := public.hercules_prompt_trace_reserve_sequence('smallz');
  other := public.hercules_prompt_trace_reserve_sequence('another_agent');
  IF first <> 1 OR second <> 2 OR other <> 1 THEN
    RAISE EXCEPTION 'sequence_allocation_not_monotonic_or_isolated';
  END IF;
  IF public.hercules_prompt_trace_reserve_sequence('../bad') IS NOT NULL
     OR public.hercules_prompt_trace_reserve_sequence('') IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_source_not_denied';
  END IF;
  IF (SELECT last_issued FROM public.hercules_prompt_trace_emit_counters WHERE source='smallz') <> 2 THEN
    RAISE EXCEPTION 'wrong_durable_sequence';
  END IF;
  IF has_table_privilege('anon','public.hercules_prompt_trace_emit_counters','SELECT')
    OR has_table_privilege('authenticated','public.hercules_prompt_trace_emit_counters','SELECT')
    OR has_function_privilege('anon','public.hercules_prompt_trace_reserve_sequence(text)','EXECUTE')
    OR has_function_privilege('authenticated','public.hercules_prompt_trace_reserve_sequence(text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.hercules_prompt_trace_reserve_sequence(text)','EXECUTE')
  THEN
    RAISE EXCEPTION 'emit_sequence_privilege_violation';
  END IF;
END
$assert$;

BEGIN;
SELECT public.hercules_prompt_trace_reserve_sequence('rollback_worker');
ROLLBACK;

DO $assert$
BEGIN
  IF EXISTS(SELECT 1 FROM public.hercules_prompt_trace_emit_counters WHERE source='rollback_worker') THEN
    RAISE EXCEPTION 'rollback_did_not_revert_sequence';
  END IF;
END
$assert$;
