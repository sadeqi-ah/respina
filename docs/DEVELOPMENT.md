# Development

Everything runs in Docker with `make up` (see the [README](../README.md)). This page covers working
on one component directly, the Make targets, debugging, and the tooling used to build the project.

## Running components without Docker

Start the shared pieces once, from the repository root:

```bash
make env keys                 # .env and the JWT keypair
docker compose up -d db       # PostgreSQL on 127.0.0.1:5432 (roles are created on first start)
```

Then stop the compose copy of whichever component you're working on (e.g.
`docker compose stop frontend`) so its port is free.

| Component | Toolchain | Run | Test |
|---|---|---|---|
| backend | Python 3.12, uv | `cd backend && cp .env.example .env && uv sync && uv run python manage.py migrate && uv run python manage.py runserver` | `uv run pytest` |
| frontend | Node.js 22 | `cd frontend && npm install && npm run dev` with `DJANGO_API_URL=http://localhost:8000` in `frontend/.env.local` | `npm test`, `npm run e2e` |
| health-service | Go 1.25+ | `cd health-service && HEALTH_DATA_SOURCE=memory go run ./cmd/healthsvc` (no DB; sample ids 125 and 126) | `go test -race ./...` |
| php-module | Docker only (dev image) | see [php-module/README.md](../php-module/README.md#development) | `vendor/bin/phpunit` in the dev image |

Notes:

- **backend**: `backend/.env` points at `localhost:5432` and `../secrets/*.pem`; real environment
  variables always win. Tests use PostgreSQL, not SQLite, so CHECK constraints, expression
  indexes and row locks behave as in production.
- **frontend**: `npm run dev` uses Turbopack. The language comes from the `NEXT_LOCALE` cookie.
- **health-service**: to read the real database, set `HEALTH_DATABASE_URL` to the `health_ro` URL
  with `localhost` as the host.
- **php-module**: there's no local PHP requirement; the `dev` stage of `docker/Dockerfile` has PHP
  8.3, `pdo_pgsql` and Composer, with the source bind-mounted.

## Make targets

| Target | Does |
|---|---|
| `make env` | Create `.env` from `.env.example` (never overwrites) |
| `make keys` | Generate the JWT keypair in `secrets/` (keeps existing keys) |
| `make build` | Build all images |
| `make up` | Build and start the stack, return when every service is healthy |
| `make down` | Stop the stack (keeps the database volume; `docker compose down -v` deletes it) |
| `make ps` / `make logs` | Service status / follow all logs |
| `make seed` | Load demo data (idempotent); `make seed ARGS=--reset` starts over (needs `SEED_ALLOW_RESET=true`) |
| `make migrate` | Run Django migrations in the running backend (`up` already does this on start) |
| `make psql` | `psql` in the db container as the owner role |
| `make test` / `make lint` / `make fmt` | Every component's tests / linters / formatters |
| `make smoke` | Cross-service smoke test against the running stack |

## Debugging

**Follow one request across components.** Every component reads or creates an `X-Request-ID`,
returns it as a header and in error bodies (`error.request_id`), and logs it. The BFF forwards it
to Django. So with the id from a failing response (or the browser's network tab):

```bash
docker compose logs --no-log-prefix backend frontend php health | grep 8f2c1e
```

**Logs.** `make logs`, or per service: `docker compose logs -f backend`. Django and gunicorn log
to stdout; Go uses structured `slog` lines; PHP writes to stderr.

Django and Go each write one `"request"` line per request with its timing. A Django one:

```json
{"level": "INFO", "logger": "apps.core.request", "message": "request", "request_id": "demo-42", "method": "GET", "path": "/nope", "status": 404, "duration_ms": 2}
```

**Database.**

```bash
make psql
```

```sql
-- the audit trail of one service
SELECT * FROM service_status_logs WHERE service_id = 125 ORDER BY created_at DESC;
-- what a least-privilege role is allowed to do
SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
WHERE grantee IN ('health_ro', 'php_module');
```

**Health.** `make ps` shows each container's health. Every image has a `HEALTHCHECK`:

| Service | Check |
|---|---|
| backend | `/healthz` (pings the database) |
| health | `-healthcheck` flag |
| php | `/healthz` |
| frontend | `/api/health` (liveness only: stays healthy while Django is down) |

`docker inspect --format '{{json .State.Health}}' respina-backend-1` shows the last probe outputs.

**Slow or odd queries.** The backend tests assert query counts for the list endpoints
(`CaptureQueriesContext`), so an N+1 regression fails CI.
Locally, `DJANGO_DEBUG=true` plus the Django shell (`docker compose exec backend python manage.py
shell`) with `connection.queries` shows the SQL for a call.

**Frontend.** BFF requests appear in the browser's network tab under `/api/backend/*`, each with
its `X-Request-ID`. In dev, Next.js shows server and client errors in its overlay.

## Development tooling

| Area | Tools |
|---|---|
| Backend | uv, ruff (lint + format), pytest + pytest-django, factory-boy, drf-spectacular |
| Frontend | ESLint, Prettier (+ Tailwind class sorting), TypeScript, Vitest + Testing Library + msw, Playwright, `scripts/lint-rtl.mjs` |
| Go | gofmt, go vet, `go test -race` |
| PHP | PHPStan, PHPUnit, `bin/sql-guard.sh` (rejects non-literal SQL) |
| Repo | pre-commit (whitespace, YAML, large files, gitleaks, ruff, gofmt), GitHub Actions per component, actionlint |

### AI-assisted development

The project was built with **Claude Code** (Anthropic), working from
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) phase by phase, in a "learning" mode where the
maintainer writes the key decisions and the agent does the rest.

**Who wrote what.**

- *The agent* wrote most of the code, tests, Dockerfiles and docs: scaffolding, endpoints, UI
  components, wiring.
- *The maintainer* wrote the pieces where the design decision matters most, with the agent
  leaving a single marked placeholder and a test suite to satisfy. Examples:
  - the service state machine (`transitions.py`);
  - the BFF's refresh-once logic;
  - URL parameter parsing;
  - phone validation;
  - the optimistic status update and its rollback;
  - the touch-target hit area;
  - the frontend health route;
  - the JWT key permissions;
  - the cross-service smoke test and the CI pipeline.
- Plan items marked 🔒 were owner-implemented by design.

**How output was reviewed.** Nothing was committed on the agent's word alone. Before each commit:

- Every component's linters, type checks and tests ran.
- The behaviour was checked against the **running system**:
  - curl against the real API;
  - the browser in both languages and three widths;
  - expired-token and concurrent-refresh scenarios against Django;
  - the full compose stack from an empty volume;
  - the smoke test.
- The maintainer reviewed and approved each step and its commit.

**What that review caught.** Running things, not reading them, found most of the problems. Some
were in the agent's own output, some in the code under test:

- reusable refresh tokens (fixed with a blacklist and a shared refresh);
- foreign keys without database-level `ON DELETE`;
- a table cutting off its action column at tablet width, missed by a page-scroll check;
- a dropped toast caused by a component remount;
- a 10% flaky smoke test, and one 404 check that could pass vacuously;
- a CI Go version older than `go.mod`;
- an msw option silently ignored after a major upgrade.

**Limits.** Generated code was treated like a colleague's pull request: plausible isn't proof.
Claims about libraries were checked against the installed versions, and security-relevant
pieces (auth, scoping, roles, secrets) were reviewed line by line.
