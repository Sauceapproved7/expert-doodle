#!/bin/sh
set -eu
mkdir -p /backups
pg_dump --format=custom --no-owner --no-acl -h postgres -U hercules_admin hercules_staging > "/backups/hercules-staging-$(date -u +%Y%m%dT%H%M%SZ).dump"
