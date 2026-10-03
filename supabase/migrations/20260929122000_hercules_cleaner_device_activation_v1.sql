-- Hercules Cleaner device activation v1
-- Privacy-preserving device identity: opaque UUID + Ed25519 public key only.
-- Activation codes and device credentials are stored only as SHA-256 hashes.

create table if not exists public.hercules_cleaner_activation_codes (
  id uuid primary key default gen_random_uuid(),
  code_sha256 text not null unique check (code_sha256 ~ '^[a-f0-9]{64}$'),
  product_code text not null default 'hercules-cleaner' check (product_code='hercules-cleaner'),
  organization_id uuid,
  access_request_id uuid references public.hercules_software_access_requests(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_device_id uuid,
  revoked_at timestamptz
);

create table if not exists public.hercules_cleaner_device_challenges (
  id uuid primary key default gen_random_uuid(),
  activation_code_id uuid not null references public.hercules_cleaner_activation_codes(id) on delete cascade,
  device_id uuid not null,
  platform text not null check (platform in ('windows','macos','linux')),
  cleaner_version text not null check (cleaner_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  public_key_pem text not null check (length(public_key_pem) between 80 and 1000),
  challenge_sha256 text not null check (challenge_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists public.hercules_cleaner_devices (
  device_id uuid primary key,
  product_code text not null default 'hercules-cleaner' check (product_code='hercules-cleaner'),
  organization_id uuid,
  access_request_id uuid references public.hercules_software_access_requests(id) on delete set null,
  platform text not null check (platform in ('windows','macos','linux')),
  cleaner_version text not null check (cleaner_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  public_key_pem text not null check (length(public_key_pem) between 80 and 1000),
  credential_sha256 text not null unique check (credential_sha256 ~ '^[a-f0-9]{64}$'),
  activated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

create index if not exists hercules_cleaner_activation_codes_active_idx
  on public.hercules_cleaner_activation_codes(expires_at)
  where used_at is null and revoked_at is null;

create index if not exists hercules_cleaner_device_challenges_active_idx
  on public.hercules_cleaner_device_challenges(device_id,expires_at)
  where used_at is null;

alter table public.hercules_cleaner_activation_codes enable row level security;
alter table public.hercules_cleaner_device_challenges enable row level security;
alter table public.hercules_cleaner_devices enable row level security;

revoke all on public.hercules_cleaner_activation_codes from anon, authenticated;
revoke all on public.hercules_cleaner_device_challenges from anon, authenticated;
revoke all on public.hercules_cleaner_devices from anon, authenticated;

create schema if not exists private;
grant usage on schema private to service_role;

create or replace function private.hercules_activate_cleaner_device(
  p_activation_code_sha256 text,
  p_challenge_id uuid,
  p_device_id uuid,
  p_platform text,
  p_cleaner_version text,
  p_public_key_pem text,
  p_credential_sha256 text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code public.hercules_cleaner_activation_codes%rowtype;
  v_challenge public.hercules_cleaner_device_challenges%rowtype;
  v_activated_at timestamptz := now();
begin
  if p_activation_code_sha256 !~ '^[a-f0-9]{64}$'
     or p_credential_sha256 !~ '^[a-f0-9]{64}$'
     or p_platform not in ('windows','macos','linux')
     or p_cleaner_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$'
     or length(p_public_key_pem) not between 80 and 1000 then
    raise exception 'invalid_cleaner_device_activation_payload';
  end if;

  select * into v_code
  from public.hercules_cleaner_activation_codes
  where code_sha256=p_activation_code_sha256
  for update;

  if not found
     or v_code.used_at is not null
     or v_code.revoked_at is not null
     or v_code.expires_at <= now() then
    raise exception 'activation_code_unavailable';
  end if;

  select * into v_challenge
  from public.hercules_cleaner_device_challenges
  where id=p_challenge_id
  for update;

  if not found
     or v_challenge.used_at is not null
     or v_challenge.expires_at <= now()
     or v_challenge.activation_code_id<>v_code.id
     or v_challenge.device_id<>p_device_id
     or v_challenge.platform<>p_platform
     or v_challenge.cleaner_version<>p_cleaner_version
     or v_challenge.public_key_pem<>p_public_key_pem then
    raise exception 'activation_challenge_unavailable';
  end if;

  insert into public.hercules_cleaner_devices(
    device_id,product_code,organization_id,access_request_id,
    platform,cleaner_version,public_key_pem,credential_sha256,activated_at
  ) values (
    p_device_id,'hercules-cleaner',v_code.organization_id,v_code.access_request_id,
    p_platform,p_cleaner_version,p_public_key_pem,p_credential_sha256,v_activated_at
  )
  on conflict (device_id) do update set
    organization_id=excluded.organization_id,
    access_request_id=excluded.access_request_id,
    platform=excluded.platform,
    cleaner_version=excluded.cleaner_version,
    public_key_pem=excluded.public_key_pem,
    credential_sha256=excluded.credential_sha256,
    activated_at=excluded.activated_at,
    revoked_at=null;

  update public.hercules_cleaner_activation_codes
  set used_at=now(), used_by_device_id=p_device_id
  where id=v_code.id and used_at is null;

  update public.hercules_cleaner_device_challenges
  set used_at=now()
  where id=v_challenge.id and used_at is null;

  return jsonb_build_object(
    'ok',true,
    'deviceId',p_device_id,
    'productCode','hercules-cleaner',
    'activatedAt',v_activated_at
  );
end
$$;

revoke all on function private.hercules_activate_cleaner_device(text,uuid,uuid,text,text,text,text) from public;
grant execute on function private.hercules_activate_cleaner_device(text,uuid,uuid,text,text,text,text) to service_role;

create or replace function public.hercules_activate_cleaner_device(
  p_activation_code_sha256 text,
  p_challenge_id uuid,
  p_device_id uuid,
  p_platform text,
  p_cleaner_version text,
  p_public_key_pem text,
  p_credential_sha256 text
) returns jsonb
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.hercules_activate_cleaner_device(
    p_activation_code_sha256,
    p_challenge_id,
    p_device_id,
    p_platform,
    p_cleaner_version,
    p_public_key_pem,
    p_credential_sha256
  );
$$;

revoke all on function public.hercules_activate_cleaner_device(text,uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.hercules_activate_cleaner_device(text,uuid,uuid,text,text,text,text) to service_role;
