-- REVIEW-ONLY CANDIDATE. Do NOT apply to a live Supabase project without
-- owner authorization, schema review and isolated PostgreSQL integration tests.
-- No actual Shopify tokens or Vault secrets are included in this file.
-- First-party Gatehouse expiring-offline owner-only Shopify order-read custody.
-- Neither Hercules Shopify webhooks nor existing provider connection is changed.

create schema if not exists hercules_private;
revoke all on schema hercules_private from public, anon, authenticated;

create table hercules_private.gatehouse_shopify_offline_grants (
 organization_id uuid primary key references public.hercules_organizations(id) on delete cascade,
 owner_user_id uuid not null,
 client_id text not null default '1ed12710f0b797a7a3328c1cf4e8b1f9'
  check (client_id = '1ed12710f0b797a7a3328c1cf4e8b1f9'),
 shop_gid text not null default 'gid://shopify/Shop/100002726208'
  check (shop_gid = 'gid://shopify/Shop/100002726208'),
 shop_domain text not null default 'azymhc-x0.myshopify.com'
  check (shop_domain = 'azymhc-x0.myshopify.com'),
 access_secret_ref uuid not null,
 refresh_secret_ref uuid not null,
 access_expires_at timestamptz not null,
 refresh_expires_at timestamptz not null,
 generation bigint not null default 1 check (generation > 0),
 lease_nonce uuid,
 lease_expires_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 constraint gatehouse_pair_expiry check (refresh_expires_at > access_expires_at),
 constraint gatehouse_lease_pair check ((lease_nonce is null) = (lease_expires_at is null))
);
alter table hercules_private.gatehouse_shopify_offline_grants enable row level security;
revoke all on hercules_private.gatehouse_shopify_offline_grants from public, anon, authenticated;
-- Deliberately no SELECT / UPDATE grants or RLS policies for consumer roles.
-- Only privileged security-definer RPCs below touch this table.

create or replace function hercules_private.gatehouse_require_owner(
 p_organization_id uuid,p_owner_user_id uuid
) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
 if coalesce(auth.role(), '') <> 'service_role'
    or p_organization_id is distinct from 'ea5fb196-67f9-42fa-b592-49eeb3b84346'::uuid
    or p_owner_user_id is null
    or not exists (
      select 1 from public.hercules_memberships m
      where m.organization_id = p_organization_id
        and m.user_id = p_owner_user_id
        and m.role = 'owner' and m.status = 'active'
    )
 then
  raise exception 'gatehouse_owner_authorization_required' using errcode = '42501';
 end if;
end;
$$;
revoke all on function hercules_private.gatehouse_require_owner(uuid,uuid)
 from public, anon, authenticated, service_role;

create or replace function public.gatehouse_offline_bootstrap(
 p_organization_id uuid,p_owner_user_id uuid,
 p_access_token text,p_refresh_token text,
 p_access_expires_at timestamptz,p_refresh_expires_at timestamptz
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
 v_new_access uuid;
 v_new_refresh uuid;
begin
 perform hercules_private.gatehouse_require_owner(p_organization_id,p_owner_user_id);
 if p_access_token is null or p_access_token !~ '^shpat_[A-Za-z0-9._-]+$'
    or length(p_access_token) not between 22 and 4006
    or p_refresh_token is null or p_refresh_token !~ '^shprt_[A-Za-z0-9._-]+$'
    or length(p_refresh_token) not between 22 and 4006
    or p_access_token = p_refresh_token
    or p_access_expires_at <= clock_timestamp() + interval '60 seconds'
    or p_access_expires_at > clock_timestamp() + interval '24 hours'
    or p_refresh_expires_at <= p_access_expires_at
    or p_refresh_expires_at > clock_timestamp() + interval '365 days'
 then
  return pg_catalog.jsonb_build_object('stored',false,'generation',0);
 end if;
 -- A second simultaneous bootstrap causes a unique-key exception and the
 -- entire transaction (including both Vault inserts) rolls back. Never UPSERT.
 if exists (
  select 1 from hercules_private.gatehouse_shopify_offline_grants g
   where g.organization_id = p_organization_id
 ) then
  return pg_catalog.jsonb_build_object('stored',false,'generation',0);
 end if;
 v_new_access := vault.create_secret(p_access_token);
 v_new_refresh := vault.create_secret(p_refresh_token);
 insert into hercules_private.gatehouse_shopify_offline_grants (
  organization_id,owner_user_id,access_secret_ref,refresh_secret_ref,
  access_expires_at,refresh_expires_at,generation
 ) values (
  p_organization_id,p_owner_user_id,v_new_access,v_new_refresh,
  p_access_expires_at,p_refresh_expires_at,1
 );
 return pg_catalog.jsonb_build_object('stored',true,'generation',1);
end;
$$;

create or replace function public.gatehouse_offline_acquire(
 p_organization_id uuid,p_owner_user_id uuid
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
 r hercules_private.gatehouse_shopify_offline_grants%rowtype;
 v_refresh text;
begin
 perform hercules_private.gatehouse_require_owner(p_organization_id,p_owner_user_id);
 -- Exactly one claimant wins the atomic database UPDATE. A lease always
 -- expires after 90s, allowing safe recovery after crashed workers.
 update hercules_private.gatehouse_shopify_offline_grants g
 set lease_nonce = pg_catalog.gen_random_uuid(),
     lease_expires_at = clock_timestamp() + interval '90 seconds',
     updated_at = clock_timestamp()
 where g.organization_id = p_organization_id
   and g.owner_user_id = p_owner_user_id
   and g.refresh_expires_at > clock_timestamp()
   and (g.lease_nonce is null or g.lease_expires_at < clock_timestamp())
 returning g.* into r;
 if not found then
  return pg_catalog.jsonb_build_object('leased',false);
 end if;
 select decrypted_secret into v_refresh from vault.decrypted_secrets
  where id = r.refresh_secret_ref;
 if v_refresh is null then
  raise exception 'gatehouse_private_secret_unavailable' using errcode = '42501';
 end if;
 -- This secret leaves Postgres only to the service-role owner worker.
 -- Never expose this RPC to browsers, consumers or any anonymous role.
 return pg_catalog.jsonb_build_object(
  'leased',true,'organization_id',r.organization_id,
  'shop_domain',r.shop_domain,'shop_gid',r.shop_gid,
  'lease_nonce',r.lease_nonce,'generation',r.generation,
  'refresh_token',v_refresh,
  'access_expires_at',r.access_expires_at,
  'refresh_expires_at',r.refresh_expires_at
 );
end;
$$;

create or replace function public.gatehouse_offline_commit(
 p_organization_id uuid,p_owner_user_id uuid,p_lease_nonce uuid,
 p_expected_generation bigint,p_access_token text,p_refresh_token text,
 p_access_expires_at timestamptz,p_refresh_expires_at timestamptz
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
 r hercules_private.gatehouse_shopify_offline_grants%rowtype;
 v_old_refresh text;
 v_new_access uuid;
 v_new_refresh uuid;
begin
 perform hercules_private.gatehouse_require_owner(p_organization_id,p_owner_user_id);
 -- A row lock protects BOTH Vault secret inserts and pointer CAS update
 -- inside one Postgres transaction. We never hold this row lock over HTTP.
 select * into r
 from hercules_private.gatehouse_shopify_offline_grants
 where organization_id = p_organization_id
   and owner_user_id = p_owner_user_id
   and lease_nonce = p_lease_nonce
   and lease_expires_at > clock_timestamp()
   and generation = p_expected_generation
 for update;
 if not found or p_lease_nonce is null
    or p_access_token is null or p_access_token !~ '^shpat_[A-Za-z0-9._-]+$'
    or length(p_access_token) not between 22 and 4006
    or p_refresh_token is null or p_refresh_token !~ '^shprt_[A-Za-z0-9._-]+$'
    or length(p_refresh_token) not between 22 and 4006
    or p_access_token = p_refresh_token
    or p_access_expires_at <= clock_timestamp() + interval '60 seconds'
    or p_access_expires_at > clock_timestamp() + interval '24 hours'
    or p_refresh_expires_at <= p_access_expires_at
    or p_refresh_expires_at > clock_timestamp() + interval '365 days'
 then
  return pg_catalog.jsonb_build_object('stored',false,'generation',p_expected_generation);
 end if;
 select decrypted_secret into v_old_refresh from vault.decrypted_secrets
  where id = r.refresh_secret_ref;
 if v_old_refresh is null or p_refresh_token = v_old_refresh then
  return pg_catalog.jsonb_build_object('stored',false,'generation',p_expected_generation);
 end if;
 v_new_access := vault.create_secret(p_access_token);
 v_new_refresh := vault.create_secret(p_refresh_token);
 update hercules_private.gatehouse_shopify_offline_grants
 set access_secret_ref = v_new_access, refresh_secret_ref = v_new_refresh,
     access_expires_at = p_access_expires_at,
     refresh_expires_at = p_refresh_expires_at,
     generation = r.generation + 1,
     updated_at = clock_timestamp()
 where organization_id = p_organization_id
   and owner_user_id = p_owner_user_id
   and lease_nonce = p_lease_nonce
   and generation = p_expected_generation;
 if not found then
  -- Raise so BOTH Vault writes are automatically rolled back.
  raise exception 'gatehouse_atomic_rotation_conflict' using errcode = '40001';
 end if;
 -- Keep the lease until a separate RELEASE RPC; the v2.14 worker
 -- releases in finally. Old encrypted Vault refs are not deleted here.
 return pg_catalog.jsonb_build_object('stored',true,'generation',r.generation+1);
end;
$$;

create or replace function public.gatehouse_offline_release(
 p_organization_id uuid,p_owner_user_id uuid,p_lease_nonce uuid
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
 perform hercules_private.gatehouse_require_owner(p_organization_id,p_owner_user_id);
 if p_lease_nonce is null then
  return pg_catalog.jsonb_build_object('released',false);
 end if;
 update hercules_private.gatehouse_shopify_offline_grants
 set lease_nonce = null,lease_expires_at = null,
     updated_at = clock_timestamp()
 where organization_id = p_organization_id
   and owner_user_id = p_owner_user_id
   and lease_nonce = p_lease_nonce;
 return pg_catalog.jsonb_build_object('released',found);
end;
$$;

-- Always revoke PostgreSQL's default PUBLIC EXECUTE on every exposed function.
revoke all on function public.gatehouse_offline_bootstrap(
 uuid,uuid,text,text,timestamptz,timestamptz
) from public, anon, authenticated;
revoke all on function public.gatehouse_offline_acquire(uuid,uuid)
 from public, anon, authenticated;
revoke all on function public.gatehouse_offline_commit(
 uuid,uuid,uuid,bigint,text,text,timestamptz,timestamptz
) from public, anon, authenticated;
revoke all on function public.gatehouse_offline_release(uuid,uuid,uuid)
 from public, anon, authenticated;

grant execute on function public.gatehouse_offline_bootstrap(
 uuid,uuid,text,text,timestamptz,timestamptz
) to service_role;
grant execute on function public.gatehouse_offline_acquire(uuid,uuid)
 to service_role;
grant execute on function public.gatehouse_offline_commit(
 uuid,uuid,uuid,bigint,text,text,timestamptz,timestamptz
) to service_role;
grant execute on function public.gatehouse_offline_release(uuid,uuid,uuid)
 to service_role;

-- No migrations applied by creating this reviewed source file.
-- Production deployment requires independent DB integration tests,
-- owner-signed change authorization and secure trusted backend wiring.
