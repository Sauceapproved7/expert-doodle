-- Regression fix: ON CONFLICT DO NOTHING reads unique-conflict metadata through
-- SELECT authorization. The public founder role deliberately has no SELECT rights.
-- Duplicate and rate behavior are already guaranteed in the private BEFORE INSERT trigger,
-- including returning NULL for duplicates while holding an advisory transaction lock.
BEGIN;
CREATE OR REPLACE FUNCTION public.hercules_cloud_join_founders(
 p_email text,
 p_consent boolean,
 p_interest text DEFAULT 'both',
 p_website text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $rpc$
DECLARE
 em text;
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
    OR position('..' in em)>0 OR
    p_interest IS NULL OR p_interest NOT IN ('both','software','self-hosted')
 THEN
   RETURN jsonb_build_object('ok',false,'error','invalid_interest_or_email');
 END IF;
 INSERT INTO public.hercules_cloud_founders(
   email,interest,notice_version,privacy_policy_url,status,source
 ) VALUES (
   em,p_interest,'founding-interest-2026-10-13',
   'https://checkout.shopify.com/100002726208/policies/53002207552.html?locale=en',
   'unverified','hercules-cloud-origin-preview'
 );
 RETURN jsonb_build_object('ok',true,'status','interest_recorded_unverified');
EXCEPTION
 WHEN SQLSTATE 'P7501' THEN
   RETURN jsonb_build_object('ok',false,'error','busy');
 WHEN SQLSTATE 'P7502' THEN
   RETURN jsonb_build_object('ok',false,'error','intake_temporarily_full');
 WHEN others THEN
   RETURN jsonb_build_object('ok',false,'error','intake_unavailable');
END
$rpc$;

DO $guard$
DECLARE public_definer boolean;
BEGIN
 SELECT prosecdef INTO public_definer FROM pg_proc
 WHERE oid='public.hercules_cloud_join_founders(text,boolean,text,text)'::regprocedure;
 IF public_definer IS DISTINCT FROM false OR
 has_table_privilege('anon','public.hercules_cloud_founders','SELECT') OR
 has_table_privilege('authenticated','public.hercules_cloud_founders','SELECT') OR
 NOT has_column_privilege('anon','public.hercules_cloud_founders','email','INSERT')
 THEN RAISE EXCEPTION 'hercules_founders_no_select_boundary_failed'; END IF;
END
$guard$;
COMMIT;
