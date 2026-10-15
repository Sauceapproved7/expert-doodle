-- Disposable PostgreSQL tests for bounded out-of-order trace claims.
DO $$ BEGIN
 IF NOT public.hercules_prompt_trace_claim_sequence('multi_worker', 6) THEN RAISE EXCEPTION 'first_claim_failed'; END IF;
 IF NOT public.hercules_prompt_trace_claim_sequence('multi_worker', 5) THEN RAISE EXCEPTION 'late_claim_rejected'; END IF;
 IF public.hercules_prompt_trace_claim_sequence('multi_worker', 5) THEN RAISE EXCEPTION 'duplicate_claim_accepted'; END IF;
 IF NOT public.hercules_prompt_trace_claim_sequence('window_worker', 5000) THEN RAISE EXCEPTION 'window_setup_failed'; END IF;
 IF public.hercules_prompt_trace_claim_sequence('window_worker', 904) THEN RAISE EXCEPTION 'expired_claim_accepted'; END IF;
 IF NOT public.hercules_prompt_trace_claim_sequence('window_worker', 905) THEN RAISE EXCEPTION 'bounded_late_claim_rejected'; END IF;
END $$;

-- Upgraded historical counters are a permanent deny floor.
DO $verify$
BEGIN
 IF public.hercules_prompt_trace_claim_sequence('smallz',4)
   OR public.hercules_prompt_trace_claim_sequence('smallz',3) THEN
   RAISE EXCEPTION 'legacy_replay_accepted';
 END IF;
 IF NOT public.hercules_prompt_trace_claim_sequence('smallz',6)
   OR NOT public.hercules_prompt_trace_claim_sequence('smallz',5) THEN
   RAISE EXCEPTION 'late_post_upgrade_claim_denied';
 END IF;
 IF public.hercules_prompt_trace_claim_sequence('smallz',5) THEN
   RAISE EXCEPTION 'post_upgrade_duplicate_accepted';
 END IF;
 IF NOT public.hercules_prompt_trace_claim_sequence('window_worker',10000) THEN
   RAISE EXCEPTION 'window_advance_failed';
 END IF;
 IF public.hercules_prompt_trace_claim_sequence('window_worker',905) THEN
   RAISE EXCEPTION 'pruned_claim_reaccepted';
 END IF;
 IF EXISTS(SELECT 1 FROM public.hercules_prompt_trace_claimed_sequences
           WHERE source='window_worker' AND sequence <= 5904) THEN
   RAISE EXCEPTION 'expired_claim_retained';
 END IF;
 IF public.hercules_prompt_trace_claim_sequence('window_worker',9007199254740992)
   OR public.hercules_prompt_trace_claim_sequence('window_worker',0) THEN
   RAISE EXCEPTION 'invalid_sequence_accepted';
 END IF;
 IF has_table_privilege('anon','public.hercules_prompt_trace_claimed_sequences','SELECT')
   OR has_table_privilege('authenticated','public.hercules_prompt_trace_claimed_sequences','SELECT') THEN
   RAISE EXCEPTION 'private_claim_table_exposed';
 END IF;
END $verify$;

BEGIN;
SELECT public.hercules_prompt_trace_claim_sequence('rollback_window',20);
ROLLBACK;
DO $verify$
BEGIN
 IF NOT public.hercules_prompt_trace_claim_sequence('rollback_window',19) THEN
   RAISE EXCEPTION 'rollback_did_not_release_claim';
 END IF;
END $verify$;
