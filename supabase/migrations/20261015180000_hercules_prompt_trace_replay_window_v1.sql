-- Source-only migration. Bounded, deduplicating out-of-order replay claims.
-- Apply only to disposable staging first; no live production changes in this PR.
BEGIN;

ALTER TABLE public.hercules_prompt_trace_replay_counters
  ADD COLUMN IF NOT EXISTS legacy_floor bigint NOT NULL DEFAULT 0;
-- Previously accepted claims were stored only as a high-water mark.
-- They must remain rejected after upgrading the replay algorithm.
UPDATE public.hercules_prompt_trace_replay_counters
SET legacy_floor = last_sequence
WHERE legacy_floor = 0;

CREATE TABLE IF NOT EXISTS public.hercules_prompt_trace_claimed_sequences (
  source text NOT NULL CHECK (source ~ '^[A-Za-z0-9_-]{1,64}$'),
  sequence bigint NOT NULL CHECK (sequence BETWEEN 1 AND 9007199254740991),
  PRIMARY KEY (source, sequence)
);

ALTER TABLE public.hercules_prompt_trace_claimed_sequences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hercules_prompt_trace_claimed_sequences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.hercules_prompt_trace_claimed_sequences TO service_role;

CREATE OR REPLACE FUNCTION public.hercules_prompt_trace_claim_sequence(
  p_source text, p_sequence bigint
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_high bigint;
  v_floor bigint;
  v_inserted integer;
BEGIN
  IF p_source IS NULL OR p_source !~ '^[A-Za-z0-9_-]{1,64}$'
    OR p_sequence IS NULL OR p_sequence NOT BETWEEN 1 AND 9007199254740991 THEN
    RETURN false;
  END IF;

  -- One row lock serializes claims for each source across all workers.
  INSERT INTO public.hercules_prompt_trace_replay_counters AS counter
    (source,last_sequence,updated_at)
  VALUES (p_source,p_sequence,now())
  ON CONFLICT (source) DO UPDATE
    SET last_sequence = GREATEST(counter.last_sequence,EXCLUDED.last_sequence),
        updated_at = now()
  RETURNING last_sequence,legacy_floor INTO v_high,v_floor;

  -- Preserve the pre-upgrade rejection floor; bound storage and replay age.
  IF p_sequence <= v_floor OR p_sequence <= v_high - 4096 THEN
    RETURN false;
  END IF;

  INSERT INTO public.hercules_prompt_trace_claimed_sequences(source,sequence)
  VALUES (p_source,p_sequence)
  ON CONFLICT (source,sequence) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Bounded per-source retention, protected by the same source row lock.
  DELETE FROM public.hercules_prompt_trace_claimed_sequences
  WHERE source=p_source AND sequence <= v_high - 4096;

  RETURN v_inserted = 1;
END;
$body$;

REVOKE ALL ON FUNCTION public.hercules_prompt_trace_claim_sequence(text,bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hercules_prompt_trace_claim_sequence(text,bigint)
  TO service_role;

DO $verify$
BEGIN
  IF has_table_privilege('anon','public.hercules_prompt_trace_claimed_sequences','SELECT')
    OR has_table_privilege('authenticated','public.hercules_prompt_trace_claimed_sequences','SELECT')
    OR has_function_privilege('anon','public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE')
    OR has_function_privilege('authenticated','public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.hercules_prompt_trace_claim_sequence(text,bigint)','EXECUTE')
  THEN
    RAISE EXCEPTION 'prompt_trace_window_privilege_violation';
  END IF;
END $verify$;
COMMIT;
