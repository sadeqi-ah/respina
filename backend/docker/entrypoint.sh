#!/bin/sh
# Container start: wait for Postgres, apply migrations, then hand PID 1 to gunicorn.
set -eu

python /app/docker/wait_for_db.py
python manage.py migrate --noinput

exec gunicorn config.wsgi \
  --workers "${GUNICORN_WORKERS:-3}" \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile - \
  --no-control-socket \
  --forwarded-allow-ips "${GUNICORN_FORWARDED_ALLOW_IPS:-127.0.0.1}"
