-- Least-privilege correction for the source-only prompt-trace replay RPC.
-- Must be staged and verified before any production migration.
BEGIN;
ALTER FUNCTION public.hercules_prompt_trace_claim_sequence(text,bigint)
  SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.hercules_prompt_trace_claim_sequence(text,bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hercules_prompt_trace_claim_sequence(text,bigint)
  TO service_role;
DO $check$
BEGIN
 IF (SELECT prosecdef FROM pg_proc
     WHERE oid='public.hercules_prompt_trace_claim_sequence(text,bigint)'::regprocedure) THEN
   RAISE EXCEPTION 'replay_function_not_invoker_scoped';
 END IF;
 IF has_function_privilege('anon','public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE')
    OR has_function_privilege('authenticated','public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE') THEN
   RAISE EXCEPTION 'trace_claim_privilege_exposure';
 END IF;
END $check$;
COMMIT;
