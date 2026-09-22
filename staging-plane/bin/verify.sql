select case when count(*)=2 and bool_and(synthetic) then true else false end as synthetic_identities_ok from staging_api.test_identities;
select case when count(*)>=2 and bool_and(synthetic) then true else false end as synthetic_records_ok from staging_api.fixture_records;
select ok and environment='staging' as health_ok from staging_api.health where id=1;
