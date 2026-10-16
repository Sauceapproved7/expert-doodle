-- Existing Supabase Free projects may have reached Edge Function quotas.
-- This isolated PostgREST RPC collects unverified consent requests without additional services.
-- The table remains private: no anon/authenticated SELECT, INSERT, UPDATE or DELETE grants.
BEGIN;
CREATE OR REPLACE FUNCTION public.hercules_cloud_join_founders(
 p_email text,
 p_consent boolean,
 p_interest text DEFAULT 'both',
 p_website text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
 em text;
 entries bigint;
BEGIN
 IF p_consent IS NOT TRUE THEN
   RETURN jsonb_build_object('ok',false,'error','consent_required');
 END IF;
 IF length(coalesce(p_website,''))>0 THEN
   RETURN jsonb_build_object('ok',true,'status','interest_recorded_unverified');
 END IF;
 em := lower(btrim(coalesce(p_email,'')));
 IF length(em)<5 OR length(em)>254 OR
    em !~ '^[a-z0-9][a-z0-9._+%-]*@[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
    OR position('..' in em)>0
    OR p_interest IS NULL OR p_interest NOT IN ('both','software','self-hosted')
 THEN
   RETURN jsonb_build_object('ok',false,'error','invalid_interest_or_email');
 END IF;
 -- Global concurrent-insert capacity protection; return a generic busy result.
 IF NOT pg_try_advisory_xact_lock(hashtext('hercules-cloud-founders-v1')) THEN
   RETURN jsonb_build_object('ok',false,'error','busy');
 END IF;
 SELECT count(*) INTO entries
 FROM public.hercules_cloud_founders
 WHERE created_at >= now() - interval '24 hours';
 IF entries >= 200 THEN
   RETURN jsonb_build_object('ok',false,'error','intake_temporarily_full');
 END IF;
 INSERT INTO public.hercules_cloud_founders(
   email,interest,notice_version,privacy_policy_url,status,source
 ) VALUES (
   em,p_interest,'founding-interest-2026-10-13',
   'https://checkout.shopify.com/100002726208/policies/53002207552.html?locale=en',
   'unverified','hercules-cloud-origin-preview'
 )
 ON CONFLICT (email) DO NOTHING;
 RETURN jsonb_build_object('ok',true,'status','interest_recorded_unverified');
EXCEPTION WHEN others THEN
 -- Do not disclose email, row existence, underlying database errors or privileged data.
 RETURN jsonb_build_object('ok',false,'error','intake_unavailable');
END
$function$;
REVOKE ALL ON FUNCTION public.hercules_cloud_join_founders(text,boolean,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hercules_cloud_join_founders(text,boolean,text,text) TO anon,authenticated;
DO $verify$
BEGIN
 IF NOT has_function_privilege('anon',
       'public.hercules_cloud_join_founders(text,boolean,text,text)','EXECUTE')
    OR NOT has_function_privilege('authenticated',
       'public.hercules_cloud_join_founders(text,boolean,text,text)','EXECUTE')
    OR has_table_privilege('anon','public.hercules_cloud_founders','SELECT')
    OR has_table_privilege('anon','public.hercules_cloud_founders','INSERT')
    OR has_table_privilege('authenticated','public.hercules_cloud_founders','SELECT')
 THEN RAISE EXCEPTION 'hercules_cloud_founders_rpc_isolation_invalid'; END IF;
END $verify$;
COMMIT;
