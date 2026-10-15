-- Hercules Prompt Intelligence durable, monotonic replay claim (source-only migration).
-- Do not apply to production without staging verification and owner-controlled rollout.
BEGIN;

CREATE TABLE IF NOT EXISTS public.hercules_prompt_trace_replay_counters (
  source text PRIMARY KEY CHECK (source ~ '^[A-Za-z0-9_-]{1,64}$'),
  last_sequence bigint NOT NULL CHECK (last_sequence > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hercules_prompt_trace_replay_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hercules_prompt_trace_replay_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.hercules_prompt_trace_replay_counters TO service_role;

CREATE OR REPLACE FUNCTION public.hercules_prompt_trace_claim_sequence(
  p_source text, p_sequence bigint
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_accepted bigint;
BEGIN
  IF p_source IS NULL OR p_source !~ '^[A-Za-z0-9_-]{1,64}$'
     OR p_sequence IS NULL OR p_sequence < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.hercules_prompt_trace_replay_counters AS counter
    (source, last_sequence, updated_at)
  VALUES (p_source, p_sequence, now())
  ON CONFLICT (source) DO UPDATE
    SET last_sequence = EXCLUDED.last_sequence,
        updated_at = now()
    WHERE counter.last_sequence < EXCLUDED.last_sequence
  RETURNING last_sequence INTO v_accepted;
  RETURN v_accepted IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.hercules_prompt_trace_claim_sequence(text,bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hercules_prompt_trace_claim_sequence(text,bigint)
  TO service_role;

DO $verify$
BEGIN
  IF has_table_privilege('anon','public.hercules_prompt_trace_replay_counters','SELECT')
    OR has_table_privilege('authenticated','public.hercules_prompt_trace_replay_counters','SELECT')
    OR has_function_privilege('anon','public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE')
    OR has_function_privilege('authenticated','public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE')
  THEN
    RAISE EXCEPTION 'prompt_trace_replay_privilege_violation';
  END IF;
END $verify$;

COMMIT;
