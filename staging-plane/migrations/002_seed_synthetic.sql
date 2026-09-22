begin;
insert into staging_api.health(id,ok,environment) values(1,true,'staging') on conflict(id) do update set ok=true;
insert into staging_api.test_identities(id,email,app_metadata) values
('10000000-0000-4000-8000-000000000001','owner@fixture.invalid','{"role":"owner","synthetic":true}'),
('10000000-0000-4000-8000-000000000002','member@fixture.invalid','{"role":"member","synthetic":true}')
on conflict(id) do nothing;
insert into staging_api.fixture_records(owner_id,payload) values
('10000000-0000-4000-8000-000000000001','{"kind":"benchmark","value":42}'),
('10000000-0000-4000-8000-000000000002','{"kind":"benchmark","value":84}');
commit;
