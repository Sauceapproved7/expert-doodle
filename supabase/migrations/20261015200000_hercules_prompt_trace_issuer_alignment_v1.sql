-- Source-only corrective migration: align issuance with durable replay history.
-- Prevent a new Smallz emitter from reserving already-claimed sequences.
-- Apply only in isolated staging, with browser trace enforcement off.
BEGIN;

INSERT INTO public.hercules_prompt_trace_emit_counters AS emit
  (source,last_issued,updated_at)
SELECT source,last_sequence,now()
FROM public.hercules_prompt_trace_replay_counters
WHERE last_sequence BETWEEN 1 AND 9007199254740991
ON CONFLICT (source) DO UPDATE
  SET last_issued = GREATEST(emit.last_issued,EXCLUDED.last_issued),
      updated_at = now();

DO $verify$
BEGIN
 IF EXISTS(
   SELECT 1
   FROM public.hercules_prompt_trace_replay_counters AS replay
   LEFT JOIN public.hercules_prompt_trace_emit_counters AS emit USING(source)
   WHERE replay.last_sequence > 9007199254740991
      OR emit.last_issued IS NULL
      OR emit.last_issued < replay.last_sequence
 ) THEN
   RAISE EXCEPTION 'trace_sequence_alignment_failed';
 END IF;
END $verify$;

COMMIT;
