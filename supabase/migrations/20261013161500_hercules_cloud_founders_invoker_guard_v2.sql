-- Hercules Cloud Founders: anonymous callable RPC must never run with elevated owner rights.
-- Keep the table's direct SELECT/UPDATE/DELETE closed. Public receives only bounded INSERT.
-- The private trigger is not callable by anonymous roles and enforces rate, consent metadata,
-- and duplicate suppression even for direct table INSERT attempts.
BEGIN;

CREATE OR REPLACE FUNCTION private.hercules_cloud_founders_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $guard$
DECLARE
 entries bigint;
BEGIN
 -- Normalize and validate any table insert, not just the advertised RPC.
 IF NEW.email IS NULL THEN
  RAISE EXCEPTION 'invalid_founder_email' USING ERRCODE='P7503';
 END IF;
 NEW.email := lower(btrim(NEW.email));
 IF length(NEW.email)<5 OR length(NEW.email)>254 OR
    NEW.email !~ '^[a-z0-9][a-z0-9._+%-]*@[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$' OR
    position('..' in NEW.email)>0 OR
    NEW.interest NOT IN ('both','software','self-hosted') OR NEW.interest IS NULL
 THEN RAISE EXCEPTION 'invalid_founder_email' USING ERRCODE='P7503';
 END IF;

 -- Freeze unverified-only semantics and the consent notice. This is not verified opt-in.
 NEW.status:='unverified';
 NEW.source:='hercules-cloud-origin-preview';
 NEW.notice_version:='founding-interest-2026-10-13';
 NEW.privacy_policy_url:='https://checkout.shopify.com/100002726208/policies/53002207552.html?locale=en';
 NEW.consent_at:=now();
 NEW.created_at:=now();

 -- Serialize capacity/duplicate checks across API calls. No row contents are returned.
 IF NOT pg_try_advisory_xact_lock(hashtext('hercules-cloud-founders-v1')) THEN
   RAISE EXCEPTION 'intake_busy' USING ERRCODE='P7501';
 END IF;
 IF EXISTS (SELECT 1 FROM public.hercules_cloud_founders WHERE email = NEW.email) THEN
   RETURN NULL;
 END IF;
 SELECT count(*) INTO entries
 FROM public.hercules_cloud_founders
 WHERE created_at >= now() - interval '24 hours';
 IF entries >= 200 THEN
   RAISE EXCEPTION 'intake_temporarily_full' USING ERRCODE='P7502';
 END IF;
 RETURN NEW;
END
$guard$;

REVOKE ALL ON FUNCTION private.hercules_cloud_founders_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS hercules_cloud_founders_guard_insert ON public.hercules_cloud_founders;
CREATE TRIGGER hercules_cloud_founders_guard_insert
BEFORE INSERT ON public.hercules_cloud_founders
FOR EACH ROW EXECUTE FUNCTION private.hercules_cloud_founders_guard();

ALTER TABLE public.hercules_cloud_founders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hercules_cloud_founders FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.hercules_cloud_founders_id_seq FROM PUBLIC,anon,authenticated;
-- Per-column insert grants do not allow selecting, enumerating or reading lead emails.
GRANT INSERT (email,interest,notice_version,privacy_policy_url,status,source)
ON public.hercules_cloud_founders TO anon,authenticated;
DROP POLICY IF EXISTS hercules_cloud_founders_limited_insert ON public.hercules_cloud_founders;
CREATE POLICY hercules_cloud_founders_limited_insert
ON public.hercules_cloud_founders FOR INSERT TO anon,authenticated
WITH CHECK (
 email = lower(btrim(email))
 AND interest IN ('both','software','self-hosted')
 AND status='unverified'
 AND source='hercules-cloud-origin-preview'
 AND notice_version='founding-interest-2026-10-13'
 AND privacy_policy_url='https://checkout.shopify.com/100002726208/policies/53002207552.html?locale=en'
);

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
 )
 ON CONFLICT (email) DO NOTHING;
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
REVOKE ALL ON FUNCTION public.hercules_cloud_join_founders(text,boolean,text,text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hercules_cloud_join_founders(text,boolean,text,text)
  TO anon,authenticated;

DO $verify$
DECLARE
 public_definer boolean;
 private_callable boolean;
BEGIN
 SELECT prosecdef INTO public_definer FROM pg_proc
 WHERE oid='public.hercules_cloud_join_founders(text,boolean,text,text)'::regprocedure;
 SELECT has_function_privilege('anon',
  'private.hercules_cloud_founders_guard()','EXECUTE') INTO private_callable;
 IF public_definer IS DISTINCT FROM false OR private_callable OR
    has_table_privilege('anon','public.hercules_cloud_founders','SELECT') OR
    has_table_privilege('authenticated','public.hercules_cloud_founders','SELECT') OR
    NOT has_column_privilege('anon','public.hercules_cloud_founders','email','INSERT')
 THEN RAISE EXCEPTION 'hercules_cloud_founders_invoker_boundary_failed'; END IF;
END
$verify$;
COMMIT;
