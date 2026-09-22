#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 -h postgres -U hercules_admin -d hercules_staging <<'SQL'
create schema if not exists hercules_migrations;
create table if not exists hercules_migrations.applied(name text primary key, applied_at timestamptz not null default now());
SQL
for role in staging_anon staging_user; do
  exists="$(psql -At -h postgres -U hercules_admin -d hercules_staging -c "select count(*) from pg_roles where rolname='$role'")"
  if [ "$exists" = "0" ]; then psql -v ON_ERROR_STOP=1 -h postgres -U hercules_admin -d hercules_staging -c "create role $role nologin"; fi
done
api_exists="$(psql -At -h postgres -U hercules_admin -d hercules_staging -c "select count(*) from pg_roles where rolname='hercules_api'")"
if [ "$api_exists" = "0" ]; then
  psql -v ON_ERROR_STOP=1 -h postgres -U hercules_admin -d hercules_staging -c "create role hercules_api login password '$HERCULES_STAGING_API_PASSWORD' noinherit"
else
  psql -v ON_ERROR_STOP=1 -h postgres -U hercules_admin -d hercules_staging -c "alter role hercules_api password '$HERCULES_STAGING_API_PASSWORD'"
fi
for migration in /migrations/*.sql; do
  name="$(basename "$migration")"
  applied="$(psql -At -h postgres -U hercules_admin -d hercules_staging -c "select count(*) from hercules_migrations.applied where name='$name'")"
  if [ "$applied" = "0" ]; then
    psql -v ON_ERROR_STOP=1 -h postgres -U hercules_admin -d hercules_staging -f "$migration"
    psql -v ON_ERROR_STOP=1 -h postgres -U hercules_admin -d hercules_staging -c "insert into hercules_migrations.applied(name) values('$name')"
  fi
done
