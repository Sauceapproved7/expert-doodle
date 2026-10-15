-- Disposable PostgreSQL tests for bounded out-of-order trace claims.
DO $$ BEGIN
 IF NOT public.hercules_prompt_trace_claim_sequence('multi_worker', 6) THEN RAISE EXCEPTION 'first_claim_failed'; END IF;
 IF NOT public.hercules_prompt_trace_claim_sequence('multi_worker', 5) THEN RAISE EXCEPTION 'late_claim_rejected'; END IF;
 IF public.hercules_prompt_trace_claim_sequence('multi_worker', 5) THEN RAISE EXCEPTION 'duplicate_claim_accepted'; END IF;
 IF NOT public.hercules_prompt_trace_claim_sequence('window_worker', 5000) THEN RAISE EXCEPTION 'window_setup_failed'; END IF;
 IF public.hercules_prompt_trace_claim_sequence('window_worker', 904) THEN RAISE EXCEPTION 'expired_claim_accepted'; END IF;
 IF NOT public.hercules_prompt_trace_claim_sequence('window_worker', 905) THEN RAISE EXCEPTION 'bounded_late_claim_rejected'; END IF;
END $$;
