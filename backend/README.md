# backend

Django + DRF API. System of record: owns the schema, issues JWTs (RS256), enforces business rules.
See `docs/IMPLEMENTATION_PLAN.md`, Phase 1.

## Local development (outside Docker)

Requires `uv`, plus the root setup (`make env keys`) and a running database (`docker compose up -d db`).

```bash
cp .env.example .env        # backend/.env: localhost DB + ../secrets keys
uv sync
uv run python manage.py migrate
uv run pytest
```

`backend/.env` is only read when present; real environment variables always win. In Docker,
compose passes the root `.env` values instead.

Tests run against PostgreSQL (not SQLite) so CHECK constraints, expression indexes and row locks
behave as in production. pytest-django creates a `test_cloudpanel` database.

## Layout

Layering: **views → serializers (validation) → use_cases (writes) / selectors (reads, scoping) → models**.

| Path | Purpose |
|---|---|
| `config/settings.py` | 12-factor settings via `django-environ` |
| `apps/core/` | error envelope, request IDs, JSON logging, pagination, permissions, `/healthz` |
| `apps/accounts/` | custom `User` (email login, `role`), JWT claims, `/api/v1/auth/*` |
| `apps/customers/` | `Customer` |
| `apps/cloud/` | `Service`, `ServiceStatusLog`, DB role grants migration |

## `check --deploy`

`uv run python manage.py check --deploy` reports only HTTPS-related warnings locally (W004, W008,
W012, W016) and W009 for the placeholder secret key. In a real deployment set a long random
`DJANGO_SECRET_KEY` and enable `DJANGO_SECURE_SSL_REDIRECT`, `DJANGO_SECURE_COOKIES` and
`DJANGO_SECURE_HSTS_SECONDS` behind TLS.

## Refresh tokens

Refresh tokens rotate and the old one is blacklisted (`BLACKLIST_AFTER_ROTATION`, ADR-012), so a
refresh token works exactly once. Every issued refresh token is recorded in the
`token_blacklist_outstandingtoken` table; prune expired rows periodically:

```bash
uv run python manage.py flushexpiredtokens
```
