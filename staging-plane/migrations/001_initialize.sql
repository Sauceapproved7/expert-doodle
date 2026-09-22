begin;
grant staging_anon,staging_user to hercules_api;

create schema if not exists staging_api authorization hercules_admin;
revoke all on schema public from public;
grant usage on schema staging_api to staging_anon,staging_user;

create table staging_api.health (
  id integer primary key check (id=1),
  ok boolean not null,
  environment text not null check (environment='staging'),
  seeded_at timestamptz not null default now()
);

create table staging_api.test_identities (
  id uuid primary key,
  email text not null unique check (email like '%@fixture.invalid'),
  app_metadata jsonb not null check (app_metadata ? 'role'),
  synthetic boolean not null default true check (synthetic)
);

create table staging_api.fixture_records (
  id bigint generated always as identity primary key,
  owner_id uuid not null references staging_api.test_identities(id),
  payload jsonb not null,
  synthetic boolean not null default true check (synthetic),
  created_at timestamptz not null default now()
);

alter table staging_api.health enable row level security;
alter table staging_api.test_identities enable row level security;
alter table staging_api.fixture_records enable row level security;

grant select on staging_api.health to staging_anon,staging_user;
grant select on staging_api.test_identities,staging_api.fixture_records to staging_user;
grant insert,update,delete on staging_api.fixture_records to staging_user;
grant usage,select on sequence staging_api.fixture_records_id_seq to staging_user;

create policy health_read on staging_api.health for select to staging_anon,staging_user using (environment='staging');
create policy identity_self_read on staging_api.test_identities for select to staging_user using (id=(select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid));
create policy fixture_owner_read on staging_api.fixture_records for select to staging_user using (owner_id=(select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid));
create policy fixture_owner_insert on staging_api.fixture_records for insert to staging_user with check (owner_id=(select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid) and synthetic);
create policy fixture_owner_update on staging_api.fixture_records for update to staging_user using (owner_id=(select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)) with check (owner_id=(select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid) and synthetic);
create policy fixture_owner_delete on staging_api.fixture_records for delete to staging_user using (owner_id=(select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid));
commit;
