-- Only ephemeral GitHub Actions Docker database; never a production migration.
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
 AS $$SELECT nullif(current_setting('request.jwt.claim.role',true),'')::text$$;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;
CREATE TABLE public.hercules_organizations(id uuid primary key);
CREATE TABLE public.hercules_memberships(
 organization_id uuid not null,user_id uuid not null,role text not null,status text not null
);
INSERT INTO public.hercules_organizations(id) VALUES
 ('ea5fb196-67f9-42fa-b592-49eeb3b84346');
INSERT INTO public.hercules_memberships(organization_id,user_id,role,status) VALUES
 ('ea5fb196-67f9-42fa-b592-49eeb3b84346',
  '0388a570-7e32-4d63-9bee-9df0c877bbf9','owner','active');
CREATE TABLE public.gatehouse_test_observation(
 id integer primary key,lease_nonce uuid not null
);
