-- Add a strictly scoped, existing-owner read surface and an unverified early-tester
-- request path. This DOES NOT enable Hercules public Auth signup or mail delivery.
BEGIN;
CREATE TABLE IF NOT EXISTS public.hercules_circle_owner_acl (
  user_id uuid PRIMARY KEY,
  granted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hercules_circle_owner_acl ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hercules_circle_owner_acl FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.hercules_circle_owner_acl TO authenticated;
DROP POLICY IF EXISTS hercules_circle_owner_acl_self ON public.hercules_circle_owner_acl;
CREATE POLICY hercules_circle_owner_acl_self ON public.hercules_circle_owner_acl
FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

-- Must be exactly one owner account that already exists in Supabase Auth.
-- Never create an owner/admin account or trust client-provided owner role values.
DO $owner$
DECLARE owner_count int;
BEGIN
 SELECT count(DISTINCT m.user_id) INTO owner_count
 FROM public.hercules_memberships m
 WHERE m.role='owner' AND m.status='active'
   AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id=m.user_id);
 IF owner_count <> 1 THEN
  RAISE EXCEPTION 'hercules_circle_existing_owner_unverified';
 END IF;
 INSERT INTO public.hercules_circle_owner_acl(user_id)
 SELECT DISTINCT m.user_id
 FROM public.hercules_memberships m
 WHERE m.role='owner' AND m.status='active'
   AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id=m.user_id)
 ON CONFLICT (user_id) DO NOTHING;
END $owner$;

-- This RLS SELECT policy permits only allowlisted, currently active Hercules owners.
-- Public role STILL has no SELECT grant to the founding-interest email table.
REVOKE SELECT ON public.hercules_cloud_founders FROM anon;
GRANT SELECT ON public.hercules_cloud_founders TO authenticated;
DROP POLICY IF EXISTS hercules_cloud_founders_owner_select ON public.hercules_cloud_founders;
CREATE POLICY hercules_cloud_founders_owner_select
ON public.hercules_cloud_founders FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.hercules_circle_owner_acl a
  JOIN public.hercules_memberships m ON m.user_id=a.user_id
  WHERE a.user_id=(select auth.uid())
    AND m.role='owner' AND m.status='active'
));

CREATE TABLE IF NOT EXISTS public.hercules_circle_early_requests (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 email text NOT NULL UNIQUE
   CHECK (length(email) BETWEEN 5 AND 254 AND email=lower(btrim(email))
      AND email !~ '[[:space:]]'),
 use_case text NOT NULL CHECK (use_case IN ('software','ecommerce','developer_tools','other')),
 project_stage text NOT NULL CHECK (project_stage IN ('idea','prototype','live')),
 consent_at timestamptz NOT NULL DEFAULT now(),
 notice_version text NOT NULL DEFAULT 'early-tester-interest-2026-10-13',
 status text NOT NULL DEFAULT 'unverified' CHECK (status='unverified'),
 source text NOT NULL DEFAULT 'hercules-owned-circle-free',
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hercules_circle_early_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hercules_circle_early_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.hercules_circle_early_requests TO authenticated;
GRANT INSERT (email,use_case,project_stage)
 ON public.hercules_circle_early_requests TO anon,authenticated;
DROP POLICY IF EXISTS hercules_circle_early_owner_select ON public.hercules_circle_early_requests;
CREATE POLICY hercules_circle_early_owner_select
ON public.hercules_circle_early_requests FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.hercules_circle_owner_acl a
  JOIN public.hercules_memberships m ON m.user_id=a.user_id
  WHERE a.user_id=(select auth.uid())
    AND m.role='owner' AND m.status='active'
));
DROP POLICY IF EXISTS hercules_circle_early_request_insert ON public.hercules_circle_early_requests;
CREATE POLICY hercules_circle_early_request_insert
ON public.hercules_circle_early_requests FOR INSERT TO anon,authenticated
WITH CHECK (
 email=lower(btrim(email))
 AND use_case IN ('software','ecommerce','developer_tools','other')
 AND project_stage IN ('idea','prototype','live')
 AND status='unverified'
 AND notice_version='early-tester-interest-2026-10-13'
 AND source='hercules-owned-circle-free'
);

CREATE OR REPLACE FUNCTION private.hercules_circle_early_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $guard$
DECLARE total bigint;
BEGIN
 NEW.email:=lower(btrim(coalesce(NEW.email,'')));
 IF length(NEW.email)<5 OR length(NEW.email)>254
  OR NEW.email !~ '^[a-z0-9][a-z0-9._+%-]*@[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
  OR position('..' in NEW.email)>0
  OR NEW.use_case NOT IN ('software','ecommerce','developer_tools','other')
  OR NEW.project_stage NOT IN ('idea','prototype','live')
  OR NEW.use_case IS NULL OR NEW.project_stage IS NULL
 THEN RAISE EXCEPTION 'invalid_early_request' USING ERRCODE='P7503';
 END IF;
 -- Apply canonical privacy and non-entitlement flags to every insertion path.
 NEW.status:='unverified';
 NEW.source:='hercules-owned-circle-free';
 NEW.notice_version:='early-tester-interest-2026-10-13';
 NEW.consent_at:=now();
 NEW.created_at:=now();
 -- Duplicates and daily capacity serialized across clients; no SELECT is granted.
 IF NOT pg_try_advisory_xact_lock(hashtext('hercules-circle-early-v1')) THEN
  RAISE EXCEPTION 'early_intake_busy' USING ERRCODE='P7501';
 END IF;
 IF EXISTS (SELECT 1 FROM public.hercules_circle_early_requests WHERE email=NEW.email) THEN
  RETURN NULL;
 END IF;
 SELECT count(*) INTO total FROM public.hercules_circle_early_requests
 WHERE created_at >= now()-interval '24 hours';
 IF total >= 40 THEN
  RAISE EXCEPTION 'early_intake_full' USING ERRCODE='P7502';
 END IF;
 RETURN NEW;
END
$guard$;
REVOKE ALL ON FUNCTION private.hercules_circle_early_guard()
 FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS hercules_circle_early_insert_guard ON public.hercules_circle_early_requests;
CREATE TRIGGER hercules_circle_early_insert_guard
BEFORE INSERT ON public.hercules_circle_early_requests
FOR EACH ROW EXECUTE FUNCTION private.hercules_circle_early_guard();

CREATE OR REPLACE FUNCTION public.hercules_circle_request_early(
 p_email text,
 p_consent boolean,
 p_use_case text DEFAULT 'developer_tools',
 p_project_stage text DEFAULT 'idea',
 p_website text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=pg_catalog,public
AS $rpc$
DECLARE em text;
BEGIN
 IF p_consent IS NOT TRUE THEN
  RETURN jsonb_build_object('ok',false,'error','consent_required');
 END IF;
 -- Bot honeypot returns no indication of whether an address exists.
 IF length(coalesce(p_website,''))>0 THEN
  RETURN jsonb_build_object('ok',true,'status','early_interest_unverified');
 END IF;
 em:=lower(btrim(coalesce(p_email,'')));
 IF length(em)<5 OR length(em)>254
  OR em !~ '^[a-z0-9][a-z0-9._+%-]*@[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
  OR position('..' in em)>0
  OR p_use_case NOT IN ('software','ecommerce','developer_tools','other')
  OR p_project_stage NOT IN ('idea','prototype','live')
  OR p_use_case IS NULL OR p_project_stage IS NULL
 THEN RETURN jsonb_build_object('ok',false,'error','invalid_request');
 END IF;
 INSERT INTO public.hercules_circle_early_requests(email,use_case,project_stage)
 VALUES (em,p_use_case,p_project_stage);
 RETURN jsonb_build_object('ok',true,'status','early_interest_unverified');
EXCEPTION
 WHEN SQLSTATE 'P7501' THEN
  RETURN jsonb_build_object('ok',false,'error','busy');
 WHEN SQLSTATE 'P7502' THEN
  RETURN jsonb_build_object('ok',false,'error','intake_temporarily_full');
 WHEN others THEN
  RETURN jsonb_build_object('ok',false,'error','intake_unavailable');
END
$rpc$;
REVOKE ALL ON FUNCTION public.hercules_circle_request_early(text,boolean,text,text,text)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hercules_circle_request_early(text,boolean,text,text,text)
 TO anon,authenticated;

-- Defense-in-depth: verify owner ACL and private data remain inaccessible to anon.
DO $verify$
BEGIN
 IF has_table_privilege('anon','public.hercules_cloud_founders','SELECT')
 OR has_table_privilege('anon','public.hercules_circle_early_requests','SELECT')
 OR has_table_privilege('anon','public.hercules_circle_owner_acl','SELECT')
 OR has_function_privilege('anon','private.hercules_circle_early_guard()','EXECUTE')
 OR (SELECT prosecdef FROM pg_proc WHERE oid='public.hercules_circle_request_early(text,boolean,text,text,text)'::regprocedure)
 OR (SELECT count(*) FROM public.hercules_circle_owner_acl) <> 1
 THEN RAISE EXCEPTION 'hercules_circle_owner_beta_security_verification_failed'; END IF;
END $verify$;
COMMIT;
