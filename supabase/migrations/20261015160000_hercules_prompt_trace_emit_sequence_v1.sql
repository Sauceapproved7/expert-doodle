-- Trusted Smallz trace sequence issuer — source-only and unapplied.
-- Replay claimant remains separate and fail-closed.
BEGIN;

CREATE TABLE IF NOT EXISTS public.hercules_prompt_trace_emit_counters (
  source text PRIMARY KEY CHECK (source ~ '^[A-Za-z0-9_-]{1,64}$'),
  last_issued bigint NOT NULL CHECK (last_issued BETWEEN 1 AND 9007199254740991),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hercules_prompt_trace_emit_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hercules_prompt_trace_emit_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.hercules_prompt_trace_emit_counters TO service_role;

CREATE OR REPLACE FUNCTION public.hercules_prompt_trace_reserve_sequence(p_source text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_sequence bigint;
BEGIN
  IF p_source IS NULL OR p_source !~ '^[A-Za-z0-9_-]{1,64}$' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.hercules_prompt_trace_emit_counters AS counter
    (source,last_issued,updated_at)
  VALUES (p_source,1,now())
  ON CONFLICT (source) DO UPDATE
    SET last_issued = counter.last_issued + 1,
        updated_at = now()
    WHERE counter.last_issued < 9007199254740991
  RETURNING last_issued INTO v_sequence;
  RETURN v_sequence;
END;
$body$;

REVOKE ALL ON FUNCTION public.hercules_prompt_trace_reserve_sequence(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hercules_prompt_trace_reserve_sequence(text)
  TO service_role;

DO $verify$
BEGIN
  IF has_table_privilege('anon','public.hercules_prompt_trace_emit_counters','SELECT')
    OR has_table_privilege('authenticated','public.hercules_prompt_trace_emit_counters','SELECT')
    OR has_function_privilege('anon','public.hercules_prompt_trace_reserve_sequence(text)','EXECUTE')
    OR has_function_privilege('authenticated','public.hercules_prompt_trace_reserve_sequence(text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.hercules_prompt_trace_reserve_sequence(text)','EXECUTE')
  THEN
    RAISE EXCEPTION 'prompt_trace_sequence_role_violation';
  END IF;
END
$verify$;

COMMIT;
