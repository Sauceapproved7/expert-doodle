-- Held first-party, atomic confirmation transaction. No browser/public execute,
-- sender activation, new auth account, payment, or beta entitlement.
BEGIN;

CREATE OR REPLACE FUNCTION public.hercules_circle_consume_confirmation(
 p_token_digest text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=pg_catalog,public
AS $confirm$
DECLARE
 v_email text;
 v_updated text;
BEGIN
 IF p_token_digest IS NULL
  OR p_token_digest !~ '^[a-f0-9]{64}$' THEN
  RETURN jsonb_build_object('ok',false,'status','invalid_or_expired');
 END IF;

 -- Serialize both linked records. A confirmed token can NEVER be replayed,
 -- and an unsubscribed or already confirmed founder must not be changed.
 SELECT c.email INTO v_email
 FROM public.hercules_circle_confirmation_challenges c
 JOIN public.hercules_cloud_founders f ON f.email=c.email
 WHERE c.token_digest=p_token_digest
  AND c.status='sent'
  AND c.sent_at IS NOT NULL
  AND c.expires_at > now()
  AND f.status='unverified'
  AND f.consent_at IS NOT NULL
 FOR UPDATE OF c,f;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('ok',false,'status','invalid_or_expired');
 END IF;

 UPDATE public.hercules_cloud_founders
 SET status='confirmed'
 WHERE email=v_email AND status='unverified'
 RETURNING email INTO v_updated;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'confirmation_founder_state_conflict';
 END IF;

 UPDATE public.hercules_circle_confirmation_challenges
 SET status='confirmed', confirmed_at=now()
 WHERE email=v_updated
  AND token_digest=p_token_digest
  AND status='sent' AND expires_at>now();
 IF NOT FOUND THEN
  -- Raise to roll back the previous UPDATE as well; no partial confirmation.
  RAISE EXCEPTION 'confirmation_challenge_state_conflict';
 END IF;

 -- Email value exists only in a service-role-only response. Never log it.
 RETURN jsonb_build_object('ok',true,'status','email_confirmed_no_entitlement','email',v_updated);
END
$confirm$;

REVOKE ALL ON FUNCTION public.hercules_circle_consume_confirmation(text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hercules_circle_consume_confirmation(text)
 TO service_role;

DO $verify$
BEGIN
 IF has_function_privilege('anon','public.hercules_circle_consume_confirmation(text)','EXECUTE')
 OR has_function_privilege('authenticated','public.hercules_circle_consume_confirmation(text)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.hercules_circle_consume_confirmation(text)','EXECUTE')
 OR (SELECT prosecdef FROM pg_proc WHERE oid='public.hercules_circle_consume_confirmation(text)'::regprocedure)
 THEN
  RAISE EXCEPTION 'hercules_circle_confirm_rpc_exposure';
 END IF;
END
$verify$;
COMMIT;
