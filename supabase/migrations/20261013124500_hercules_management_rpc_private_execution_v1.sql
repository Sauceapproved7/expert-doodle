-- Restrict privileged OAuth custody helpers to the existing service-role Edge caller.

-- Leaves Hercules signup, storefront, orders, checkout and public release switch unchanged.

BEGIN;

REVOKE ALL ON FUNCTION public.hercules_supabase_management_store_registration(text,text,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.hercules_supabase_management_store_registration(text,text,text) TO service_role;

REVOKE ALL ON FUNCTION public.hercules_supabase_management_begin_authorization(text,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.hercules_supabase_management_begin_authorization(text,text) TO service_role;

REVOKE ALL ON FUNCTION public.hercules_supabase_management_complete_authorization(text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.hercules_supabase_management_complete_authorization(text,text,text,timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.hercules_supabase_management_refresh_tokens(text,text,timestamptz) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.hercules_supabase_management_refresh_tokens(text,text,timestamptz) TO service_role;

DO $verify$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.hercules_supabase_management_store_registration(text,text,text)'::regprocedure,
    'public.hercules_supabase_management_begin_authorization(text,text)'::regprocedure,
    'public.hercules_supabase_management_complete_authorization(text,text,text,timestamptz)'::regprocedure,
    'public.hercules_supabase_management_refresh_tokens(text,text,timestamptz)'::regprocedure
  ] LOOP
    IF has_function_privilege('anon', fn, 'EXECUTE')
      OR has_function_privilege('authenticated', fn, 'EXECUTE')
      OR NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
      raise exception 'management_oauth_rpc_privileges_invalid';
    END IF;
  END LOOP;
END $verify$;

COMMIT;