-- Keep the launch gate's 24-hour DevBrain evidence fresh without storing an
-- internal credential in pg_cron metadata or exposing a public trigger.
CREATE OR REPLACE FUNCTION private.hercules_devbrain_refresh_submit()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_ref uuid;
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT secret_ref INTO v_ref
  FROM public.hercules_internal_service_keys
  WHERE purpose = 'agent-coordinator' AND enabled = true;

  IF v_ref IS NULL THEN
    RAISE EXCEPTION 'devbrain_refresh_credential_unavailable';
  END IF;

  v_secret := public.hercules_get_secret(v_ref);
  IF v_secret IS NULL OR length(v_secret) = 0 THEN
    RAISE EXCEPTION 'devbrain_refresh_credential_unavailable';
  END IF;

  SELECT net.http_post(
    url := 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-devbrain-fabric',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-hercules-internal-key', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$function$;

REVOKE ALL ON FUNCTION private.hercules_devbrain_refresh_submit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.hercules_devbrain_refresh_submit() TO service_role;

-- Two refreshes per day provide margin before the launch gate's 24-hour expiry.
SELECT cron.schedule(
  'hercules-devbrain-freshness',
  '15 */12 * * *',
  'SELECT private.hercules_devbrain_refresh_submit();'
);
