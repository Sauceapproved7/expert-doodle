-- Fail closed: signed trace RPC must execute with caller's privileges, not creator's.
DO $test$
DECLARE
  v_security_definer boolean;
BEGIN
  SELECT p.prosecdef INTO v_security_definer
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='hercules_prompt_trace_claim_sequence'
    AND pg_get_function_identity_arguments(p.oid)='p_source text, p_sequence bigint';
  IF v_security_definer IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'trace_replay_rpc_must_be_security_invoker';
  END IF;
  IF has_function_privilege('anon','public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE')
     OR has_function_privilege('authenticated','public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE') THEN
    RAISE EXCEPTION 'trace_rpc_publicly_executable';
  END IF;
END $test$;

-- An actual service_role call must still be able to reserve and claim, and
-- a second call must be rejected under that same restricted role.
SET ROLE service_role;
DO $test$
BEGIN
  IF public.hercules_prompt_trace_reserve_sequence('role_scoped') <> 1 THEN
    RAISE EXCEPTION 'service_role_reserve_failed';
  END IF;
  IF NOT public.hercules_prompt_trace_claim_sequence('role_scoped',1) THEN
    RAISE EXCEPTION 'service_role_claim_failed';
  END IF;
  IF public.hercules_prompt_trace_claim_sequence('role_scoped',1) THEN
    RAISE EXCEPTION 'service_role_duplicate_accepted';
  END IF;
  IF NOT public.hercules_prompt_trace_claim_sequence('role_scoped',2) THEN
    RAISE EXCEPTION 'service_role_second_claim_failed';
  END IF;
END $test$;
RESET ROLE;

SET ROLE authenticated;
DO $test$
BEGIN
  IF has_function_privilege(current_user,'public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated_trace_claim_exposed';
  END IF;
END $test$;
RESET ROLE;
