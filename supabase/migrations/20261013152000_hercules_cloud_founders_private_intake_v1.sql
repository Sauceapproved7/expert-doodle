-- Hercules Cloud opt-in interest, separate from owner-restricted public account registration.
-- Only backend service_role may access email rows. This migration touches no commerce or launch data.
BEGIN;
CREATE TABLE IF NOT EXISTS public.hercules_cloud_founders (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 email text NOT NULL UNIQUE CHECK (length(email) BETWEEN 5 AND 254 AND email=lower(email) AND email !~ '[[:space:]]'),
 interest text NOT NULL DEFAULT 'both' CHECK (interest IN ('software','self-hosted','both')),
 consent_at timestamptz NOT NULL DEFAULT now(),
 notice_version text NOT NULL DEFAULT 'founding-interest-2026-10-13',
 privacy_policy_url text NOT NULL,
 status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified','confirmed','unsubscribed')),
 source text NOT NULL DEFAULT 'hercules-cloud-origin-preview',
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hercules_cloud_founders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hercules_cloud_founders FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.hercules_cloud_founders_id_seq FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.hercules_cloud_founders TO service_role;
GRANT USAGE ON SEQUENCE public.hercules_cloud_founders_id_seq TO service_role;
CREATE INDEX IF NOT EXISTS hercules_cloud_founders_created_at_idx
 ON public.hercules_cloud_founders(created_at DESC);
DO $verify$
DECLARE
 n int;
BEGIN
 SELECT count(*) INTO n
 FROM pg_policies
 WHERE schemaname='public' AND tablename='hercules_cloud_founders';
 IF n<>0 OR has_table_privilege('anon','public.hercules_cloud_founders','SELECT')
    OR has_table_privilege('authenticated','public.hercules_cloud_founders','SELECT')
    OR has_table_privilege('anon','public.hercules_cloud_founders','INSERT')
    OR NOT has_table_privilege('service_role','public.hercules_cloud_founders','INSERT')
 THEN RAISE EXCEPTION 'hercules_cloud_founder_isolation_invalid'; END IF;
END $verify$;
COMMIT;
