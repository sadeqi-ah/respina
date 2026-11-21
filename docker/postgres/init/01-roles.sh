#!/bin/sh
# Creates the least-privilege LOGIN roles used by the Go status service and the PHP module.
# Runs once, on an empty data volume (postgres image entrypoint). Table-level grants are NOT
# applied here: they come from a Django migration after the tables exist (plan §3.2).
#
# Values are passed to psql as variables (-v) and referenced as :"name" (identifier) or
# :'name' (literal), so psql quotes them. Never paste env values into the SQL text directly.
set -eu

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v db="$POSTGRES_DB" \
  -v health_user="$HEALTH_DB_USER" \
  -v health_password="$HEALTH_DB_PASSWORD" \
  -v php_user="$PHP_DB_USER" \
  -v php_password="$PHP_DB_PASSWORD" \
  <<'SQL'
CREATE ROLE :"health_user" WITH LOGIN PASSWORD :'health_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE :"php_user" WITH LOGIN PASSWORD :'php_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO :"health_user", :"php_user";
SQL
