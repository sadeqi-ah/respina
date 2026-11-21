# Cloud Customer Panel (Respina): Implementation Plan

> Audience: engineers and coding agents working on this repository.
> Read sections 0–3 before starting any task in section 4 onwards. They define the rules and the contracts every component depends on.

---

## 0. Overview and engineering rules

### 0.1 What we are building

The Cloud Customer Panel is a web panel for managing cloud customers and their services: registering customers, provisioning services for them, viewing services and changing their status (active / suspended). It has four runnable components that share one PostgreSQL database:

| Component | Tech | Role |
|---|---|---|
| `backend/` | Python, Django, DRF | System of record. Owns the schema, issues JWTs, enforces business rules. |
| `frontend/` | Next.js (App Router), TypeScript | Staff and customer UI. Uses a BFF (backend-for-frontend) layer for authentication. |
| `health-service/` | Go (stdlib `net/http`) | Independent service-status checker with read-only DB access. |
| `php-module/` | PHP 8.3 (no framework), PDO | Module for our PHP-based products: shows a customer's services and changes their status. |

Supporting pieces: `docker-compose.yml`, `README.md`, and `docs/` (architecture, ERD, API, decisions).

### 0.2 Technology choices

Each choice is recorded with its rationale in `docs/DECISIONS.md`.

| Area | Constraint | Choice and rationale |
|---|---|---|
| Backend | Python / Django (company standard) | **Django REST Framework**: serializers handle validation, and the OpenAPI schema comes for free |
| Database | — | **PostgreSQL 16**: CHECK constraints, expression indexes, row locks (`FOR UPDATE`), native partitioning when data grows |
| Frontend | React or Next.js | **Next.js (App Router)**: the BFF layer keeps JWTs in httpOnly cookies, removes the need for CORS, and hides the internal API URL |
| UI kit | — | **Tailwind CSS v4 + shadcn/ui + [Obsidian UI](https://temp.obsidianui.dev/docs/installation)** (a shadcn registry; we use its Dashboard Shell block) |
| Data fetching / forms | — | TanStack Query v5, React Hook Form + Zod |
| Client state | — | No global store. Server state lives in TanStack Query, shareable state in the URL, form state in RHF (see ADR-009) |
| Languages | — | **English (default, LTR) + Persian (RTL)** via `next-intl`; the Obsidian Dashboard Shell is adapted for RTL |
| Status service | Go | stdlib `net/http` + `log/slog`, `pgx/v5` |
| PHP module | PHP (Laravel allowed) | Plain PHP 8.3 + PDO, matching our existing plain-PHP products (WHMCS-style modules) |
| Auth | Role-based access control | JWT RS256 (simplejwt), roles `staff` / `customer` |
| Python tooling | — | `uv`, `ruff`, `pytest` |
| Delivery | Containerized, documented setup | Docker Compose for the full stack, Makefile, GitHub Actions CI |

### 0.3 Engineering principles

1. **Security and correctness first.** Authorization (a customer never sees another customer's data), input validation, injection safety, and no secrets in the repository.
2. **Simple, readable code.** Small and obvious beats clever. Every module should be easy to understand and change by any team member.
3. **Operability.** Tests, consistent error format, request IDs in logs, health checks, one-command local startup, OpenAPI docs.
4. **Scope discipline.** Build what the requirements need. Anything beyond that goes to `docs/DECISIONS.md` as a proposal.

### 0.4 Rules for all contributors (humans and agents)

- **Don't over-engineer.** No Kubernetes, message queues, Redis, GraphQL, or services beyond those listed. If you think one is needed, propose it in `docs/DECISIONS.md` instead of building it.
- **Never commit secrets.** All configuration comes from environment variables. Only `.env.example` is committed, with placeholder values.
- **Stay inside the task's scope.** Don't edit another component's files unless the task says so.
- **Section 3 contracts are binding.** If a contract needs to change, stop and raise it; don't diverge silently.
- **Every task ends green:** its verification commands pass and the work is committed (see 0.6).
- **🔒 Owner-implemented tasks.** Security-critical and core-domain code (data scoping, the status state machine, input parsing at service boundaries, the scoped PHP query) is written by the project owner. For these tasks an agent only prepares the stub (exactly one `TODO(human)` marker), the surrounding wiring and the tests, then stops.
- Use the latest stable versions at implementation time, pinned in lockfiles. Targets: Python 3.12+, Django 5.2 LTS, DRF 3.15+, PostgreSQL 16+, Node 22 LTS, Next.js 16+, Go 1.23+, PHP 8.3+.

### 0.5 Code style

| Component | Formatter / linter | Type checks | Tests |
|---|---|---|---|
| backend | `ruff format`, `ruff check` | (optional) `mypy` | `pytest`, `pytest-django` |
| frontend | `prettier`, `eslint` (next config), `lint:rtl` | `tsc --noEmit`, `strict: true` | `vitest` + Testing Library, Playwright smoke |
| health-service | `gofmt`, `go vet` | compiler | `go test -race ./...` |
| php-module | PSR-12 via `php-cs-fixer` (optional) | `phpstan` level 6 | `phpunit` |

### 0.6 Git workflow

```
main ─●──────────────────────────────────────────────────────●── v1.0.0   (releases only)
       \                                                    /
dev     ●────●──────────●──────────●──────────●──────────●─            (integration)
              \        / \        / \        /
phase/…        ●──●──●    ●──●──●    ●──●──●                           (one branch per phase / stream)
```

- `main` holds released code only. Nobody commits to it directly. It receives `dev` through a release merge done by the maintainer once the release checklist (section 11) passes, tagged `vX.Y.Z`.
- `dev` is the integration branch, created from `main` right after the initial commit (Task 0.0). All work lands here.
- Phase branches (`phase/0-bootstrap`, `phase/1-backend`, `phase/2-frontend`, `phase/3-go`, `phase/4-php`, `phase/5-integration`, `phase/6-docs`) are created **from `dev`** and merged **back into `dev`** with `git merge --no-ff`.
- Before merging into `dev`: tests pass, and the branch is up to date with `dev` (rebase or merge) if parallel branches landed first.
- With a GitHub remote, merges into `dev` go through pull requests (title = phase, body = completed tasks + verification output).
- **Conventional Commits**, small and focused: `feat(backend): add service status transition endpoint`, `test(go): cover invalid service_id`, `chore(docker): add postgres healthcheck`. One task ≈ 1–4 commits.
- **No tool attribution in commits or PRs**: no `Co-Authored-By:`, `Assisted-by:` or "Generated with …" lines. Development tooling is documented once, in `docs/DEVELOPMENT.md`. Agent tools must have commit attribution disabled (Claude Code: project `.claude/settings.json`, Task 0.0). Check `git log -1 --format=%B` after committing.

---

## 1. Repository layout

```
respina/
├── .claude/settings.json           ← agent tooling config (attribution off)
├── .github/workflows/ci.yml
├── .editorconfig
├── .gitignore
├── .pre-commit-config.yaml
├── .env.example
├── docker-compose.yml
├── Makefile
├── README.md
├── docs/
│   ├── IMPLEMENTATION_PLAN.md      ← this file
│   ├── ARCHITECTURE.md             ← components, flows, scaling and operations
│   ├── ERD.md                      ← Mermaid diagram
│   ├── API.md                      ← usage guide + link to Swagger
│   ├── DECISIONS.md                ← architecture decision records (ADRs)
│   ├── CONTRIBUTING.md             ← workflow + extension recipes
│   └── DEVELOPMENT.md              ← local setup details, tooling (incl. AI assistance)
├── docker/
│   └── postgres/init/01-roles.sh   ← creates least-privilege DB roles
├── secrets/                        ← gitignored; JWT keypair generated by `make keys`
├── backend/
├── frontend/
├── health-service/
└── php-module/
```

---

## 2. Dependencies and parallel work

```
Phase 0 (bootstrap)
   │
   ▼
Phase 1, tasks 1.1–1.4 (schema, auth, error format)  ── lands first: owns schema & JWT
   │
   ├──────────────┬──────────────┬────────────────┐
   ▼              ▼              ▼                ▼
Phase 1 rest   Phase 2        Phase 3          Phase 4
(backend API)  (frontend;     (Go service;     (PHP module;
               mocked API     needs schema)    needs schema +
               at first)                       JWT public key)
   │              │              │                │
   └──────────────┴──────┬───────┴────────────────┘
                         ▼
             Phase 5 (integration, compose, CI)
                         ▼
             Phase 6 (documentation)
```

- Once tasks **1.1–1.4** are merged into `dev`, phases 1 (rest), 2, 3 and 4 can run in parallel, each in its own directory and branch.
- Shared root files (`docker-compose.yml`, `Makefile`, `README.md`, CI) are edited only in Phase 5.

---

## 3. Shared contracts

### 3.1 Services, ports and environment

| Service | Container | Host port | Internal URL |
|---|---|---|---|
| PostgreSQL | `db` | 5432 | `db:5432` |
| Django API | `backend` | 8000 | `http://backend:8000` |
| Next.js | `frontend` | 3000 | `http://frontend:3000` |
| Go status service | `health` | 8080 | `http://health:8080` |
| PHP module | `php` | 8081 | `http://php:80` |

Root `.env.example` (compose passes values to each service):

```dotenv
# --- Postgres (owner role: used by init scripts and Django migrations) ---
POSTGRES_DB=cloudpanel
POSTGRES_USER=cloudpanel_owner
POSTGRES_PASSWORD=change-me-owner

# --- Least-privilege roles (created by docker/postgres/init/01-roles.sh) ---
HEALTH_DB_USER=health_ro
HEALTH_DB_PASSWORD=change-me-health
PHP_DB_USER=php_module
PHP_DB_PASSWORD=change-me-php

# --- Django ---
DJANGO_SECRET_KEY=change-me-django-secret
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend
DATABASE_URL=postgres://cloudpanel_owner:change-me-owner@db:5432/cloudpanel
JWT_PRIVATE_KEY_PATH=/run/secrets/jwt_private.pem
JWT_PUBLIC_KEY_PATH=/run/secrets/jwt_public.pem
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=7
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=change-me-admin
SEED_CUSTOMER_PASSWORD=change-me-customer

# --- Next.js (server-side only; never NEXT_PUBLIC_) ---
DJANGO_API_URL=http://backend:8000
COOKIE_SECURE=false

# --- Go ---
HEALTH_PORT=8080
HEALTH_DATA_SOURCE=postgres          # postgres | memory
HEALTH_DATABASE_URL=postgres://health_ro:change-me-health@db:5432/cloudpanel?sslmode=disable

# --- PHP ---
PHP_DB_DSN=pgsql:host=db;port=5432;dbname=cloudpanel
JWT_PUBLIC_KEY_PATH_PHP=/run/secrets/jwt_public.pem
DJANGO_API_URL_PHP=http://backend:8000
```

### 3.2 Database schema

Django owns all migrations. Tables use **explicit `db_table` names** so the Go and PHP components work with stable, readable names.

#### `accounts_user` (custom Django user, defined before the first migration)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `email` | varchar(254) | unique, case-insensitive (`UniqueConstraint(Lower("email"))`), `USERNAME_FIELD` |
| `role` | varchar(16) | `staff` \| `customer`; CHECK constraint |
| `password`, `is_active`, `is_staff`, `is_superuser`, `last_login`, `date_joined` | Django defaults | `is_staff` = Django admin access only |

#### `customers`

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint PK (identity) | |
| `first_name` | varchar(100) | not null, trimmed, non-empty |
| `last_name` | varchar(100) | not null, trimmed, non-empty |
| `email` | varchar(254) | not null; unique on `lower(email)` |
| `phone` | varchar(20) | not null; stored as E.164 (`+989121234567`); unique |
| `user_id` | bigint FK → `accounts_user.id` | nullable, **unique** (one login per customer), `ON DELETE SET NULL` |
| `created_at` | timestamptz | default now, indexed |
| `updated_at` | timestamptz | auto-updated |

#### `services`

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint PK (identity) | |
| `customer_id` | bigint FK → `customers.id` | not null, **`ON DELETE PROTECT`** |
| `name` | varchar(100) | not null; `UNIQUE (customer_id, lower(name))` |
| `service_type` | varchar(32) | CHECK in (`cloud_server`, `vps`, `dedicated_server`, `object_storage`, `managed_database`) |
| `status` | varchar(16) | CHECK in (`active`, `suspended`); default `active` |
| `created_at` | timestamptz | default now |
| `updated_at` | timestamptz | auto-updated |

Indexes: `(customer_id, created_at DESC)`, `(status)`.

> Several programs write to this database (Django, the PHP module, future tools), so invalid states are rejected **by the database itself** through CHECK constraints, not only by Django validators.

#### `service_status_logs` (audit trail)

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint PK | |
| `service_id` | bigint FK → `services.id` | not null, `ON DELETE CASCADE` |
| `from_status` | varchar(16) | not null, same CHECK as `services.status` |
| `to_status` | varchar(16) | not null, same CHECK |
| `changed_by_id` | bigint FK → `accounts_user.id` | nullable, `ON DELETE SET NULL` |
| `source` | varchar(16) | CHECK in (`api`, `php_module`, `admin`) |
| `reason` | varchar(500) | default `''` |
| `created_at` | timestamptz | default now |

Index: `(service_id, created_at DESC)`.

#### Database roles (least privilege)

Roles are created by `docker/postgres/init/01-roles.sh`, which runs once on an empty volume and reads passwords from env. **Grants** are applied by a Django migration (`RunSQL`) after the tables exist. The migration skips a grant if its role doesn't exist, so tests run on a plain database.

| Role | Privileges |
|---|---|
| `cloudpanel_owner` | Owner; used by Django only |
| `health_ro` | `SELECT (id, status) ON services` (column-level) |
| `php_module` | `SELECT ON customers, services`; `UPDATE (status, updated_at) ON services`; `INSERT ON service_status_logs`; `USAGE ON SEQUENCE` for the log id |

### 3.3 Domain rules

**Service status state machine.** The source of truth is `backend/apps/cloud/transitions.py`; the PHP module mirrors it.

```
active ──suspend──▶ suspended
suspended ──activate──▶ active
```

- Moving a service to the status it already has is rejected with `409 Conflict`, code `invalid_status_transition`.
- An unknown status value is rejected with `400`, code `validation_error`.
- Every successful transition writes exactly one `service_status_logs` row **in the same transaction**, with the service row locked (`SELECT … FOR UPDATE`).
- Adding a status (e.g. a terminal `terminated`) must only require: the enum, the transition map, one migration for the CHECK constraint, and the PHP enum. The recipe lives in `docs/CONTRIBUTING.md`.

**Roles and permissions:**

| Action | Anonymous | `customer` | `staff` |
|---|---|---|---|
| List customers | 401 | only own record | all |
| Retrieve customer | 401 | own → 200; other → **404** | 200 |
| Create customer | 401 | 403 | 201 |
| List services of a customer | 401 | own → 200; other → **404** | 200 |
| Create service for a customer | 401 | 403 | 201 |
| Retrieve service / status history | 401 | own → 200; other → **404** | 200 |
| Change service status | 401 | 403 | 200 |

Another customer's resources return **404, not 403**, so a caller can't learn whether an ID exists (IDOR and enumeration protection). Enforcement lives in **queryset scoping** (`get_queryset`), not only in permission classes.

### 3.4 REST API (Django, base path `/api/v1`)

Responses are JSON, timestamps are ISO-8601 UTC, and IDs are integers.

#### Auth

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/v1/auth/token/` | `{email, password}` | `200 {access, refresh}` |
| POST | `/api/v1/auth/token/refresh/` | `{refresh}` | `200 {access, refresh}` (refresh rotation) |
| GET | `/api/v1/auth/me/` | — | `200 {id, email, role, customer_id}` |

JWTs are signed with **RS256**. Django holds the private key; the PHP module has only the public key, so it can verify tokens but never issue them. Custom claims: `role`, `customer_id` (nullable).

#### Customers

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/customers/?page=1&page_size=20&search=ali&ordering=-created_at` | paginated; `search` over first_name, last_name, email, phone; `ordering` ∈ `created_at`, `last_name` (± prefix) |
| POST | `/api/v1/customers/` | staff only |
| GET | `/api/v1/customers/{id}/` | scoped |
| GET | `/api/v1/customers/{id}/services/?status=active&service_type=vps` | scoped, paginated |
| POST | `/api/v1/customers/{id}/services/` | staff only |

```json
{
  "id": 12,
  "first_name": "Ali",
  "last_name": "Rezaei",
  "full_name": "Ali Rezaei",
  "email": "ali@example.com",
  "phone": "+989121234567",
  "services_count": 3,
  "created_at": "2026-11-21T10:00:00Z"
}
```

`services_count` comes from `annotate(Count(...))`. List endpoints must not have N+1 queries (enforced by tests).

Create request: `{first_name, last_name, email, phone}`. The phone accepts `09121234567`, `+989121234567` or `00989121234567` and is normalized to E.164 with `phonenumbers` (default region `IR`).

#### Services

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/services/{id}/` | scoped |
| POST | `/api/v1/services/{id}/status/` | staff only; body `{status, reason?}` |
| GET | `/api/v1/services/{id}/status-history/` | scoped, newest first |

```json
{
  "id": 125,
  "customer_id": 12,
  "name": "web-prod-1",
  "service_type": "cloud_server",
  "service_type_display": "Cloud Server",
  "status": "active",
  "created_at": "2026-11-21T10:00:00Z",
  "updated_at": "2026-11-21T10:00:00Z"
}
```

#### Pagination envelope

```json
{ "count": 132, "page": 1, "page_size": 20, "total_pages": 7, "results": [ ... ] }
```

`page_size` max 100.

#### Error envelope (all non-2xx responses, all components)

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid input.",
    "details": {
      "email": [{ "code": "unique", "message": "A customer with this email already exists." }]
    },
    "request_id": "8f2c1e…"
  }
}
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `validation_error` | Input validation failed. `details` = field → list of `{code, message}`; codes from DRF `ValidationError.get_codes()` (`required`, `invalid`, `unique`, `max_length`, `invalid_phone`, …) |
| 400 | `invalid_service_id` | (Go) non-numeric or non-positive id |
| 401 | `not_authenticated` / `token_invalid` | missing / invalid token |
| 401 | `invalid_credentials` | wrong email or password on `POST /auth/token/` |
| 403 | `permission_denied` | authenticated, but the role isn't allowed |
| 404 | `not_found` | missing **or not visible to the caller** |
| 405 | `method_not_allowed` | |
| 409 | `invalid_status_transition` / `conflict` | state machine / uniqueness race |
| 429 | `throttled` | rate limit exceeded (auth endpoints); `Retry-After` header set |
| 500 | `internal_error` | never exposes stack traces |
| 503 | `dependency_unavailable` | database unreachable |

Clients translate messages by `code` (top-level and per field) and fall back to `message` for unknown codes. `message` is always English. Go and PHP use the same shape; `details` is optional there.

#### Operational endpoints (Django)

- `GET /healthz` → `200 {"status":"ok"}`, or `503` if the database is unreachable. Used by the compose healthcheck.
- `GET /api/schema/`, `GET /api/docs/` (Swagger UI via `drf-spectacular`).

#### Request IDs

Every component accepts `X-Request-ID` (or generates a UUID4), echoes it in the response, and includes it in logs and in the error envelope. The Next.js BFF generates one per incoming request and forwards it to Django.

### 3.5 Go status service

| Request | Response |
|---|---|
| `GET /health` | `200 {"status":"healthy"}`, including a DB ping when `HEALTH_DATA_SOURCE=postgres`; DB down → `503 {"status":"unhealthy","error":{…dependency_unavailable…}}` |
| `GET /health?service_id=125` | `200 {"status":"healthy","service_id":125,"service_status":"active"}` |
| `GET /health?service_id=abc` / `0` / `-5` / `99999999999999999999` | `400` error envelope, `invalid_service_id` |
| `GET /health?service_id=999999` (missing) | `404` error envelope, `not_found` |
| `POST /health` | `405` error envelope, `Allow: GET` header |
| unknown path | `404` error envelope |

`status` describes the status service itself; `service_status` is the cloud service's status. The service is internal-network only (not published through a public gateway).

### 3.6 PHP module

| Method | Path | Type | Notes |
|---|---|---|---|
| GET | `/login` | HTML | Login form |
| POST | `/login` | HTML | Calls Django `/api/v1/auth/token/` server-side; on success stores the access token in the PHP session (`HttpOnly`, `SameSite=Lax`) |
| POST | `/logout` | HTML | CSRF-protected |
| GET | `/customers/{id}` | HTML | Customer info, services table, status actions |
| POST | `/customers/{id}/services/{serviceId}/status` | HTML form | CSRF token required; redirect back with a flash message (PRG) |
| GET | `/api/customers/{id}` | JSON | `Authorization: Bearer <jwt>` |
| GET | `/api/customers/{id}/services` | JSON | Bearer |
| POST | `/api/services/{id}/status` | JSON | Bearer; body `{status, reason?}` |

The role rules from 3.3 apply, based on the JWT claims `role` and `customer_id`. JSON routes use the standard error envelope.

---

## 4. Phase 0: Bootstrap

**Branch:** `phase/0-bootstrap` (from `dev`) · **Depends on:** nothing

### Task 0.0: Initial commit and branches

- Create `.claude/settings.json` so agent tooling never adds commit/PR attribution:

  ```json
  { "attribution": { "commit": "", "pr": "", "sessionUrl": false } }
  ```

  Use the object form; older Claude Code versions reject `"attribution": false`.
- On `main`: commit `docs/IMPLEMENTATION_PLAN.md`, `.claude/settings.json` and a one-line `README.md` as `chore: initial commit`. This is the only direct commit on `main`.
- `git switch -c dev`, then `git switch -c phase/0-bootstrap`.
- If a GitHub remote exists, push `main` and `dev`, and make `dev` the default PR target. The maintainer handles the remote settings.

### Task 0.1: Repository skeleton

- `.gitignore` (Python, Node, Go, PHP/composer, `.env`, `secrets/`, IDE files), `.editorconfig`, component directories with placeholder `README.md`s.
- `docs/DECISIONS.md` with an ADR template and these initial records:
  - **ADR-001** Monorepo.
  - **ADR-002** PostgreSQL; Django owns the schema and migrations.
  - **ADR-003** Next.js with a BFF: JWTs stay in httpOnly cookies (unreadable by browser JS), the setup is same-origin so no CORS is needed, and the internal API URL stays hidden. SSR/SEO aren't drivers; a plain React SPA would work functionally, and the BFF is the reason for Next.js.
  - **ADR-004** RS256 JWT: the PHP module verifies tokens but can't mint them.
  - **ADR-005** DB-level CHECK constraints + least-privilege roles, because the database has multiple writers.
  - **ADR-006** The PHP module writes to the database directly, as our PHP products integrate today. Trade-off: the state machine is duplicated and Django-side hooks are bypassed. Long-term direction: route writes through the Django API.
  - **ADR-007** UI: Tailwind v4 + shadcn/ui + Obsidian UI Dashboard Shell.
  - **ADR-008** i18n: English default + Persian. The Obsidian Dashboard Shell ships LTR-only, so we own its source and adapt it for RTL (logical properties, mirrored resize math, mirrored drawer). Errors are translated client-side by stable `code`, so the API stays language-neutral.
  - **ADR-009** No global client store (e.g. Zustand): server state → TanStack Query, shareable state → URL, forms → RHF, local UI → `useState`. Revisit if real cross-cutting client state appears (e.g. persisted UI preferences).
  - **ADR-010** Git flow: `main` (releases) ← `dev` (integration) ← `phase/*`.
- **Commit:** `chore: initialize repository structure`

### Task 0.2: Environment, secrets and Makefile

- Root `.env.example` exactly as in 3.1.
- `Makefile`: `help` (default), `env` (copy `.env.example` → `.env` if missing), `keys` (idempotent RSA 2048 keypair into `secrets/` via `openssl`), `up`, `down`, `logs`, `ps`, `migrate`, `seed`, `test`, `lint`, `fmt`, `psql`, `smoke`.
- `.pre-commit-config.yaml`: trailing whitespace, end-of-file, `gitleaks`, `ruff`, `gofmt`.
- **Verify:** `make env keys` succeeds twice in a row; `git status` shows no secret files.
- **Commit:** `chore: add env template, key generation and Makefile`

### Task 0.3: Postgres and roles

- `docker/postgres/init/01-roles.sh`: creates the `health_ro` and `php_module` LOGIN roles (passwords from env) with `CONNECT` on the DB only. Table grants come later from a Django migration.
- Minimal `docker-compose.yml` with only `db` (postgres:16-alpine), a named volume, a `pg_isready` healthcheck, the init dir mounted read-only, and env from `.env`.
- **Verify:** `docker compose up -d db` reaches healthy; `make psql` connects; `\du` lists the three roles.
- **Commit:** `chore(docker): add postgres with least-privilege roles`

**Merge `phase/0-bootstrap` → `dev`.**

---

## 5. Phase 1: Django backend

**Branch:** `phase/1-backend` · **Directory:** `backend/`

### Layout

```
backend/
├── pyproject.toml           # uv-managed; deps + ruff + pytest config
├── uv.lock
├── manage.py
├── Dockerfile
├── docker/entrypoint.sh     # wait for db → migrate → exec gunicorn
├── config/
│   ├── settings.py          # 12-factor, env via django-environ
│   ├── urls.py
│   └── wsgi.py
└── apps/
    ├── core/                # cross-cutting
    │   ├── exceptions.py    # DRF exception handler → error envelope
    │   ├── errors.py        # domain exceptions (InvalidStatusTransition, …)
    │   ├── middleware.py    # RequestIDMiddleware
    │   ├── logging.py       # JSON log formatter incl. request_id
    │   ├── pagination.py    # StandardPagination (3.4)
    │   ├── permissions.py   # IsStaffRole, IsStaffOrReadOnly
    │   └── views.py         # /healthz
    ├── accounts/            # custom User, JWT claims, /auth/me
    ├── customers/
    │   ├── models.py
    │   ├── validators.py    # phone normalization
    │   ├── selectors.py     # visible_customers_for(user): scoped querysets
    │   ├── serializers.py
    │   ├── views.py
    │   └── tests/
    └── cloud/               # services domain
        ├── models.py        # Service, ServiceStatusLog, enums
        ├── transitions.py   # state machine (pure, no DB)
        ├── use_cases.py     # change_service_status(...): transactional
        ├── selectors.py     # visible_services_for(user)
        ├── serializers.py
        ├── views.py
        ├── management/commands/seed.py
        └── tests/
```

Libraries: `django`, `djangorestframework`, `djangorestframework-simplejwt[crypto]`, `drf-spectacular`, `django-filter`, `django-environ`, `psycopg[binary]`, `phonenumbers`, `gunicorn`, `whitenoise`. Dev: `pytest`, `pytest-django`, `factory-boy`, `faker`, `ruff`.

Layering: **views → serializers (validation) → use_cases (writes, transactions) / selectors (reads, scoping) → models.** Views hold no business logic.

### Task 1.1: Project setup + custom user

- `uv init`, dependencies, env-driven `config/settings.py`: `DEBUG` defaults to `False`, `ALLOWED_HOSTS` comes from env. Postgres only; tests use Postgres too, so CHECK constraints and expression indexes behave as in production.
- `AUTH_USER_MODEL = "accounts.User"` **before the first migration**: email login, `role` (`TextChoices`), CHECK constraint.
- DRF defaults: `IsAuthenticated`, JWT auth, custom exception handler, pagination, `django-filter`, OpenAPI schema class.
- JSON logging + `RequestIDMiddleware`; `/healthz`.
- **Verify:** `uv run python manage.py check --deploy` (HTTPS-related warnings are acceptable locally and documented); `pytest` runs.
- **Commits:** `feat(backend): bootstrap django project`, `feat(backend): add custom user model with roles`, `feat(backend): add request id middleware and json logging`

### Task 1.2: Domain models + migrations

- `Customer`, `Service`, `ServiceStatusLog` exactly as in 3.2 (explicit `db_table`, constraints, indexes, `TextChoices` enums `ServiceType`, `ServiceStatus`, `StatusChangeSource`).
- Migration `00xx_grant_db_roles`: `RunSQL` with `DO $$ … IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '…') THEN GRANT … END IF $$` per grant in 3.2, and `REVOKE` as reverse SQL.
- Django admin for all models (`ServiceStatusLog` read-only).
- Tests: raw-SQL invalid status raises `IntegrityError`; case-only duplicate email rejected; deleting a customer with services raises `ProtectedError`.
- **Verify:** `makemigrations --check` clean; tests pass; in compose, `\dp services` shows the column grants.
- **Commits:** `feat(backend): add customer, service and status log models`, `feat(backend): grant least-privilege access to go and php roles`

### Task 1.3: Auth

- simplejwt with RS256 (key paths from env), access 15 min, refresh 7 days, rotation on.
- A custom token serializer adds the `role` and `customer_id` claims.
- `/api/v1/auth/token/`, `/token/refresh/`, `/me/`.
- Token endpoint throttling via `ScopedRateThrottle` (e.g. `10/min`).
- Tests: login, wrong password → 401 envelope, claims present, `/me` for both roles.
- **Commit:** `feat(backend): add rs256 jwt auth with role claims`

### Task 1.4: Error handling, pagination, OpenAPI

- `apps/core/exceptions.py` maps DRF `ValidationError`, `NotAuthenticated`, `AuthenticationFailed`, `PermissionDenied`, `NotFound`, `Http404`, `MethodNotAllowed`, `Throttled`, Django `ProtectedError`, `IntegrityError` (unique → 409 `conflict`) and domain `InvalidStatusTransition` (→ 409). Anything else becomes 500 `internal_error`, logged with its stack trace but never returned.
- Validation `details` are built from `exc.detail` + `exc.get_codes()` into `{field: [{code, message}]}`. Custom validators raise explicit codes (`ValidationError(..., code="invalid_phone")`).
- `StandardPagination` produces the envelope in 3.4.
- `drf-spectacular` at `/api/schema/` and `/api/docs/`, with the error envelope as a shared component.
- Tests: one per mapped error type (status, `code`, `request_id`); a duplicate email yields `details.email[0].code == "unique"`.
- **Commit:** `feat(backend): unify error envelope and pagination`

> **Milestone:** after 1.1–1.4, merge `phase/1-backend` into `dev` (an intermediate merge; work continues on the same branch). Phases 2–4 can start.

### Task 1.5: Scoped selectors 🔒 owner-implemented

The agent prepares:
- `apps/customers/selectors.py`: `def visible_customers_for(user) -> QuerySet[Customer]:`, with one `TODO(human)` and `raise NotImplementedError`.
- The permission-matrix tests (1.8), which fail until the selector is implemented.

The owner implements it: staff → all (with the `services_count` annotation); customer → `filter(user=user)`; anyone else → `none()`.
Then the agent implements `visible_services_for(user)` in `apps/cloud/selectors.py` following the same pattern.

### Task 1.6: Customer endpoints

- `CustomerViewSet` (`list`, `retrieve`, `create`) with `get_queryset()` → `visible_customers_for(request.user)`; create is staff-only.
- Serializer: trims names, normalizes the phone, checks email uniqueness case-insensitively with a clear message, and maps the concurrent-insert race (DB constraint) to 409 `conflict`.
- Filtering/search/ordering per 3.4.
- Nested `@action(detail=True, url_path="services", methods=["get","post"])` with `status` / `service_type` filters. POST is staff-only and the customer must be visible (else 404).
- **Commits:** `feat(backend): add customer endpoints`, `feat(backend): add nested customer services endpoints`

### Task 1.7: Status transitions

- `apps/cloud/transitions.py` 🔒 **owner-implemented**: the agent provides the `ALLOWED_TRANSITIONS` structure and `def assert_transition_allowed(current, target) -> None` (raises `InvalidStatusTransition`) with a `TODO(human)` body, plus pure unit tests.
- `apps/cloud/use_cases.py` (agent, after the above): `change_service_status(*, service_id, target_status, actor, reason, source) -> Service`. Inside `transaction.atomic()` it:
  1. fetches the service via `visible_services_for(actor).select_for_update()` (404 if not visible);
  2. calls `assert_transition_allowed`;
  3. updates `status` and `updated_at`;
  4. inserts a `ServiceStatusLog` row.
- Endpoints: `GET /services/{id}/`, `POST /services/{id}/status/`, `GET /services/{id}/status-history/`.
- **Commit:** `feat(backend): add service status transitions with audit log`

### Task 1.8: Test suite

- **Permission matrix:** parametrized over (anonymous, owning customer, other customer, staff) × every endpoint in 3.3, asserting exact status codes.
- **IDOR:** customer A requesting B's customer, services, service or history → 404.
- **Validation:** invalid email/phone, empty names, unknown `service_type`/status, overlong fields.
- **Phone normalization:** the three input formats normalize to one value; duplicates are detected across formats.
- **Transitions:** valid both ways; same status → 409; audit row content (from, to, actor, source); no audit row on failure.
- **Query count:** a list of 20 customers × 5 services runs a constant number of queries (`django_assert_num_queries`).
- **Pagination:** envelope shape; `page_size` capped at 100.
- Coverage ≥ 85% for `apps/` (reported, not gating).
- **Commits:** `test(backend): …`

### Task 1.9: Seed data

- `python manage.py seed [--customers 30] [--reset]`, deterministic (fixed seed, `Faker("en_US")` names, Iranian mobile numbers `09xxxxxxxxx`).
- Creates: one staff user (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`), N customers with 0–6 services each, three customers with logins (`customer1..3@example.com`, `SEED_CUSTOMER_PASSWORD`) and some status history. Service **id 125** exists, matching the API documentation examples.
- Idempotent without `--reset`.
- **Commit:** `feat(backend): add deterministic seed command`

### Task 1.10: Container image

- Multi-stage `python:3.12-slim`, `uv`, non-root user. `entrypoint.sh` waits for the DB, runs `migrate --noinput`, then `exec gunicorn config.wsgi -w 3 -b 0.0.0.0:8000 --access-logfile -`. `HEALTHCHECK` on `/healthz`.
- `collectstatic` for admin + Swagger assets, served by `whitenoise`.
- **Commit:** `build(backend): add production dockerfile`

**Merge `phase/1-backend` → `dev`.**

---

## 6. Phase 2: Next.js frontend

**Branch:** `phase/2-frontend` · **Directory:** `frontend/` · Starts after the 1.4 milestone (`msw` mocks until the API is complete)

### BFF architecture

```
Browser ──(same origin, httpOnly cookies)──▶ Next.js
                                               ├── app/api/auth/*            → login/logout/refresh, set/clear cookies
                                               └── app/api/backend/[...path] → proxy: adds Bearer, X-Request-ID, refresh-on-401
                                                                                     │
                                                                                     ▼
                                                                              Django (internal URL)
```

- Tokens live **only** in httpOnly cookies (`access_token`, `refresh_token`; `SameSite=Lax`; `Secure` via `COOKIE_SECURE`; `Path=/`). Browser JS never sees them, and Django needs no CORS configuration.
- CSRF protection for mutating proxy calls: `SameSite=Lax` cookies **and** a required `X-Requested-With: fetch` header. The proxy rejects mutating requests without it.
- `middleware.ts` redirects unauthenticated users to `/login` for `(dashboard)` routes. It only checks that the cookie exists; authorization stays in Django.
- On a Django 401 `token_invalid`, the proxy refreshes **once**, retries the request and updates the cookies. If the refresh fails, it clears the cookies and returns 401, and the client redirects to `/login`.
- The proxy forwards only paths under `/api/v1/` (allowlist), so it can't act as an open proxy (SSRF).

### Stack

Next.js (App Router, `output: "standalone"`), TypeScript strict, TanStack Query v5, React Hook Form + Zod, `sonner` toasts.

**UI is built with Tailwind CSS v4 + shadcn/ui + Obsidian UI only.** No other component library, and nothing hand-rolled that these already provide.

| Layer | Source | Used for |
|---|---|---|
| Styling | Tailwind CSS v4 (`@import "tailwindcss"`, `@tailwindcss/postcss`) | everything |
| Primitives | shadcn/ui (`npx shadcn@latest add …`) | `button`, `input`, `label`, `form`, `select`, `dialog`, `alert-dialog`, `sheet`, `dropdown-menu`, `badge`, `skeleton`, `table`, `card`, `tooltip`, `sonner` |
| App shell | Obsidian UI **Dashboard Shell** | sidebar navigation, header (title, status, actions), tabs, toolbar (filters, primary action), scrolling content, mobile drawer |
| Table patterns | Obsidian UI **dashboard-shell-page** | sortable headers, progressive column hiding, row menus, empty states, confirmations |
| Icons | `@duo-icons/react` (navigation) + `lucide-react` (inside shadcn components) | |
| Fonts | Geist (en), Vazirmatn (fa) via `next/font` | |

Obsidian UI is a **shadcn registry**. Its blocks install through the shadcn CLI into `src/components/block/` as regular source files that we own and edit:

```jsonc
// frontend/components.json
{
  "registries": {
    "@obsidian": "https://www.obsidianui.dev/r/{name}.json"
  }
}
```

```bash
npx shadcn@latest add "https://www.obsidianui.dev/r/dashboard-shell.json"
npx shadcn@latest add "https://www.obsidianui.dev/r/dashboard-shell-page.json"   # reference implementation for tables
```

**Theme:** Obsidian UI's palette is the design source. Read it from `components/block/dashboard-shell.css` and map it onto the shadcn variables in `globals.css` (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, `--destructive`, …), so dialogs, forms and toasts match the shell. Status colors: `active` green family, `suspended` amber family, always paired with a text label.

### Internationalization: English (default) + Persian (RTL)

| Concern | Decision |
|---|---|
| Library | `next-intl` (server + client components) |
| Locales | `en` (default, `dir="ltr"`), `fa` (`dir="rtl"`) |
| Locale selection | `NEXT_LOCALE` cookie, **no URL prefix**, fallback `en`. The switcher in the user menu calls a server action that sets the cookie, then `router.refresh()` |
| Messages | `src/messages/{en,fa}.json`, namespaced (`common`, `auth`, `customers`, `services`, `errors`, `validation`). Keys are type-checked via next-intl `AppConfig` augmentation; a test asserts both files have identical key sets |
| `<html>` | `lang` and `dir` set from the locale in the root layout |
| Radix / shadcn direction | Radix `DirectionProvider` with the current direction (menu alignment, tab arrow keys) |
| Fonts | Geist (en) / Vazirmatn (fa), chosen by locale |
| Dates / numbers | next-intl `useFormatter`; `fa` uses the Persian calendar (`fa-IR-u-ca-persian`) and Persian digits; `en` uses `dateStyle: "medium"` |
| Mixed-direction data | emails, phone numbers and IDs are wrapped in `<bdi dir="ltr">` |
| Client validation | Zod schemas are built by factories that receive `t` (`makeCustomerSchema(t)`) |
| Server errors | translated by `code` (`errors.<code>`, `validation.<code>`), with fallback to the envelope `message` |
| CSS rule | **logical utilities only** (`ms-/me-/ps-/pe-/start-/end-/text-start/text-end/border-s/border-e/rounded-s/rounded-e`). Directional icons get `rtl:-scale-x-100`. `npm run lint:rtl` fails on physical classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `border-l`, `border-r`, `rounded-l`, `rounded-r`) anywhere in `src/`, including the Obsidian block; it runs in CI |

### Layout

```
frontend/src/
├── app/
│   ├── layout.tsx                    # locale → lang/dir + font, NextIntlClientProvider, DirectionProvider, QueryProvider, Toaster
│   ├── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                # 'use client'; <DashboardShell> with Next <Link> as linkComponent, role-based nav, user menu
│   │   ├── page.tsx                  # redirect: staff → /customers, customer → /customers/{own id}
│   │   ├── customers/page.tsx
│   │   ├── customers/new/page.tsx
│   │   ├── customers/[id]/page.tsx
│   │   ├── loading.tsx
│   │   └── error.tsx
│   ├── not-found.tsx
│   └── api/
│       ├── auth/login/route.ts
│       ├── auth/logout/route.ts
│       └── backend/[...path]/route.ts
├── middleware.ts
├── i18n/
│   ├── config.ts             # locales, defaultLocale, dir map
│   ├── request.ts            # next-intl request config (reads NEXT_LOCALE)
│   └── actions.ts            # setLocale server action
├── messages/{en.json, fa.json}
├── lib/
│   ├── server/django.ts      # server-only fetch helper (import "server-only")
│   ├── server/cookies.ts
│   ├── api-client.ts         # browser fetch → /api/backend, parses error envelope into ApiError
│   ├── api-error.ts          # ApiError {status, code, message, details, requestId}
│   ├── format.ts             # date and phone display
│   ├── utils.ts              # cn() (shared by shadcn and Obsidian)
│   └── query-client.ts
├── features/
│   ├── auth/          (useMe, LoginForm, LocaleSwitcher)
│   ├── customers/     (api.ts, queries.ts, schemas.ts, components/CustomerTable.tsx, CustomerForm.tsx, CustomerToolbar.tsx)
│   └── services/      (api.ts, queries.ts, schemas.ts, components/ServiceList.tsx, ServiceStatusBadge.tsx, ServiceStatusToggle.tsx, AddServiceDialog.tsx, StatusHistorySheet.tsx)
├── components/
│   ├── ui/            # shadcn
│   ├── block/         # Obsidian UI blocks (owned, editable)
│   ├── states/        # LoadingSkeleton, ErrorState (retry), EmptyState
│   └── Pagination.tsx
└── types/api.ts       # TS types for contract 3.4
```

`app/` files only compose; logic lives in `features/*`.

### Task 2.1: Scaffold

- `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias '@/*'` (Tailwind v4).
- `npx shadcn@latest init`; add the shadcn components from the Stack table.
- Register `@obsidian` in `components.json`; install `dashboard-shell` and `dashboard-shell-page` plus any missing peer deps (`motion`, `clsx`, `tailwind-merge`, `lucide-react`, `@duo-icons/react`). Keep one `cn()` in `src/lib/utils.ts`.
- Map the Obsidian palette onto the shadcn theme variables.
- `next-intl` per the i18n table: config, cookie-based request config, message files, typed keys, `<html lang dir>`, fonts, `DirectionProvider`, `lint:rtl`, key-parity test.
- Prettier (+ `prettier-plugin-tailwindcss`), Vitest + Testing Library + jsdom, `msw`, Playwright.
- **Verify:** a temporary `/dashboard` route renders `DashboardShellPage` correctly at 375 px and 1280 px (remove it afterwards).
- **Commits:** `feat(frontend): scaffold next.js with tailwind and shadcn`, `feat(frontend): add obsidian ui dashboard shell and theme`, `feat(frontend): add next-intl with english and persian`

### Task 2.2: RTL support for the Dashboard Shell

The block ships LTR-only. We own its source (`src/components/block/dashboard-shell.tsx` + `.css`) and adapt it in place.

1. **Baseline:** the block is committed unmodified in 2.1, so this task's diff contains only the RTL changes and can be reapplied after upgrading the block.
2. **Audit** direction-dependent code: physical CSS (`left`, `right`, `margin-left`, `padding-right`, `border-right`, `translateX(...)`, `text-align: left`), physical Tailwind classes, and JS geometry (`clientX`, `offsetLeft`, `getBoundingClientRect().left`).
3. **CSS:** convert to logical properties (`inset-inline-start`, `margin-inline-end`, `border-inline-end`, `text-align: start`; Tailwind `start-*`, `end-*`, `ms-*`, …). Transforms that must flip use `[dir=rtl] &` / `rtl:` variants.
4. **Resizable sidebar:** read the direction (Radix `useDirection()`). In RTL the sidebar is on the right and its handle on its inline-end (left) edge, so the width delta is `-(clientX - startX)`. Clamping, double-click reset and keyboard resizing work in both directions.
5. **Sliding pill / hover highlight:** if positioned via `offsetLeft`/`left`, measure from the container's inline-start edge (`containerRect.right - itemRect.right` in RTL), or use `layoutId`-based motion, which doesn't depend on direction.
6. **Mobile drawer (< 672 px):** opens from the inline-start side; the animation direction and menu button position mirror.
7. **Icons:** directional icons mirror; neutral ones (search, settings) don't.
8. Document the changes in ADR-008.
- **Verify** in `en` and `fa` at 375 / 768 / 1280 px: sidebar side, resize direction, double-click reset, pill movement, drawer edge, mirrored toolbar/action order, column hiding order, menu alignment, no horizontal scroll. Save Playwright screenshots of both locales to `frontend/e2e/__screenshots__/` as visual baselines.
- **Commit:** `feat(frontend): add rtl support to obsidian dashboard shell`

### Task 2.3: BFF + authentication

- Route handlers and `middleware.ts` as described above; `lib/server/*` imports `server-only`.
- Login page (outside the shell): a centered shadcn `card` with an RHF + Zod form, the Obsidian palette and a locale switcher. It shows field errors and the envelope's "invalid credentials" message, and disables submit while pending.
- `useMe()` query; user menu with locale switcher and logout.
- Tests: proxy path allowlist (rejects `/api/backend/../admin` and absolute URLs); refresh-once helper.
- **Commits:** `feat(frontend): add bff proxy with httponly cookie auth`, `feat(frontend): add login flow`

### Task 2.4: Customer list

- Renders in the shell with `title` = Customers; the **toolbar** holds the search input and the staff-only "New customer" action (visibility is UX only; the API enforces).
- `CustomerTable` is adapted from the `dashboard-shell-page` table:
  - sortable name / created columns, mapped to `ordering`;
  - progressive column hiding: created → services count → phone → email; name is always shown;
  - row menu (View, Copy email);
  - demo-only features (stars, sparkline, bulk bar) removed.
- URL state: `?page=&search=&ordering=`; search debounced 300 ms.
- Columns: name, email (`bdi ltr`), phone (`bdi ltr`), services count, created date (locale-formatted; Persian calendar in `fa`). All text comes from message files.
- States: skeleton rows, `ErrorState` with retry, distinct empty states for "no data" and "no results".
- Pagination below the table.
- **Commit:** `feat(frontend): add customers list with search and pagination`

### Task 2.5: Create customer

- `/customers/new` with `CustomerForm`; the Zod schema mirrors the backend rules (required fields, email format, Iranian phone formats).
- On 400, `error.details` is mapped onto form fields via `setError` (e.g. duplicate email under the email input).
- On success: toast, invalidate the customers query, navigate to the detail page.
- **Commit:** `feat(frontend): add create customer form with server error mapping`

### Task 2.6: Customer detail + services

- Shell `title` = full name; header **status** shows the services count; header **actions** hold "Add service" (staff).
- Shell **tabs**: Services | Details (`?tab=`).
- Services tab:
  - toolbar filters: status (all / active / suspended) and type;
  - an Obsidian-style table with `ServiceStatusBadge` (shadcn `badge`, color + text);
  - a row menu: Suspend/Activate, View history.
- `AddServiceDialog` (staff): name and type, with the same server-error mapping as 2.5.
- `ServiceStatusToggle` (staff): confirmation dialog with an optional reason. Optimistic update via `onMutate`, rollback in `onError`, a translated toast on failure (e.g. 409), invalidation in `onSettled`.
- `StatusHistorySheet`: a shadcn `sheet` with the audit rows (from → to, who, source, when, reason).
- A 404 from the API renders `not-found`.
- **Commits:** `feat(frontend): add customer detail page with services`, `feat(frontend): add service creation and status change`

### Task 2.7: Responsive, accessibility and consistency pass

- In `en` and `fa` at 375 / 768 / 1280 px:
  - the shell switches to the drawer below 672 px;
  - columns hide in the defined order;
  - no horizontal scroll;
  - touch targets ≥ 44 px;
  - dialogs are full-width on mobile.
- `lint:rtl` passes; no user-facing string literals outside `messages/*.json`.
- Every shadcn component uses the Obsidian-derived variables; no hex colors outside `globals.css` and the block CSS.
- Keyboard navigation, visible focus, `aria-live` toasts.
- **Commit:** `style(frontend): responsive and accessibility pass`

### Task 2.8: Tests + container image

- Vitest:
  - Zod schemas (both locales);
  - `ApiError` parsing;
  - error code → translated message with fallback;
  - optimistic rollback in `ServiceStatusToggle` (msw);
  - server error mapping in `CustomerForm`;
  - message key parity.
- Playwright smoke per locale: login → customers → customer detail → change status; asserts `html[dir]` and the sidebar side.
- Dockerfile: multi-stage (`deps` → `build` → `runner`, `node:22-alpine`), standalone output, non-root, `HEALTHCHECK`.
- **Verify:** `npm run lint && npm run lint:rtl && npm run typecheck && npm test && npm run build`.
- **Commits:** `test(frontend): …`, `build(frontend): add dockerfile`

**Merge `phase/2-frontend` → `dev`.**

---

## 7. Phase 3: Go status service

**Branch:** `phase/3-go` · **Directory:** `health-service/` · Needs the schema (1.2)

### Layout

```
health-service/
├── go.mod
├── cmd/healthsvc/main.go        # wiring: config → store → server → graceful shutdown
├── internal/
│   ├── config/config.go         # env parsing + validation
│   ├── store/
│   │   ├── store.go             # ServiceStore interface { Status(ctx, id int64) (string, error); Ping(ctx) error }; ErrNotFound
│   │   ├── postgres.go          # pgxpool, parameterized query
│   │   └── memory.go            # sample data (includes id 125)
│   └── httpapi/
│       ├── server.go            # http.Server with ReadHeader/Read/Write/Idle timeouts
│       ├── routes.go            # "GET /health"; JSON 404/405 fallbacks
│       ├── health_handler.go
│       ├── middleware.go        # request ID, slog access log, panic recovery
│       └── respond.go           # writeJSON, writeError (envelope 3.4)
├── Dockerfile                   # golang build → gcr.io/distroless/static:nonroot
└── README.md
```

Only external dependency: `github.com/jackc/pgx/v5`.

### Task 3.1: Skeleton, config, server

- Env config: `HEALTH_PORT`, `HEALTH_DATA_SOURCE`, `HEALTH_DATABASE_URL`, `HEALTH_DB_TIMEOUT` (default `2s`). Invalid config exits with code 1 and a clear message.
- Graceful shutdown on SIGINT/SIGTERM (10 s deadline). Middleware: recover → request ID → logging.
- **Commit:** `feat(go): scaffold status service with graceful shutdown`

### Task 3.2: Stores

- `memory.go`: seeded map (`125 → active`, `126 → suspended`, …).
- `postgres.go`: `SELECT status FROM services WHERE id = $1`, `pgx.ErrNoRows → ErrNotFound`, per-query context timeout, small pool (`MaxConns` 5).
- **Commit:** `feat(go): add memory and postgres service stores`

### Task 3.3: Handler (ID parsing 🔒 owner-implemented)

- The agent wires the handler and provides `parseServiceID(raw string) (int64, error)` with a `TODO(human)` body. Table-driven tests already cover `""` (absent), `"125"`, `"0"`, `"-1"`, `"abc"`, `"1.5"`, `" 125"` and overflow.
- After the owner implements the parser, the agent completes the handler:
  - no `service_id` → ping → 200 / 503;
  - with an id → validate → `Status()` → 200 / 404 / 503 (deadline or connection error);
  - always `Content-Type: application/json; charset=utf-8` and `Cache-Control: no-store`.
- **Commit:** `feat(go): implement /health endpoint with service lookup`

### Task 3.4: Tests

- Table-driven `httptest` tests covering every row of 3.5, using the memory store and a failing fake (503).
- Optional integration test behind `//go:build integration`.
- **Verify:** `go vet ./... && go test -race ./...`.
- **Commit:** `test(go): cover health endpoint contract`

### Task 3.5: Container image + README

- Static build (`CGO_ENABLED=0`, `-trimpath -ldflags="-s -w"`), distroless non-root. Distroless has no shell, so the compose healthcheck uses a `healthsvc -healthcheck` flag.
- `README.md`: local run, env table, curl examples for every contract row, memory vs postgres mode.
- **Commit:** `build(go): add distroless dockerfile and docs`

**Merge `phase/3-go` → `dev`.**

---

## 8. Phase 4: PHP module

**Branch:** `phase/4-php` · **Directory:** `php-module/` · Needs the schema (1.2) and JWT keys (1.3)

### Layout

```
php-module/
├── composer.json            # php >=8.3, firebase/php-jwt; dev: phpunit, phpstan
├── public/index.php         # front controller; global exception handler
├── src/
│   ├── Config.php
│   ├── Database.php         # PDO: ERRMODE_EXCEPTION, EMULATE_PREPARES=false, FETCH_ASSOC
│   ├── Http/{Request.php, Response.php, Router.php}
│   ├── Auth/{JwtVerifier.php, AuthContext.php, DjangoAuthClient.php}
│   ├── Security/{Csrf.php, Session.php}
│   ├── Domain/ServiceStatus.php     # backed enum + canTransitionTo()
│   ├── Repository/{CustomerRepository.php, ServiceRepository.php}
│   ├── Validation/Validator.php
│   └── Controller/{PageController.php, ApiController.php, AuthController.php}
├── templates/{layout.php, login.php, customer.php, error.php}
├── tests/
├── docker/{Dockerfile, vhost.conf}
└── README.md
```

### Security requirements

- **SQL injection:** prepared statements with bound parameters only; `EMULATE_PREPARES=false`; no string concatenation into SQL. A CI grep guard fails on `query(` / `exec(` calls containing variables.
- **Authentication:** JWT verified with the **public key** (`firebase/php-jwt`), `exp` checked, algorithm pinned to RS256 (prevents `alg=none` and HS256 key-confusion attacks).
- **Authorization:** the 3.3 rules. Repositories take an `AuthContext` and scope their queries (`WHERE c.id = :id AND (:is_staff OR c.id = :own_customer_id)`), so another customer's data returns 404.
- **XSS:** every template output goes through `e()` = `htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')`.
- **CSRF:** a per-session token in every form, checked with `hash_equals`.
- **Sessions:** `session_regenerate_id(true)` on login; `HttpOnly`, `SameSite=Lax`, `Secure` via env.
- **Input validation:** ids `^[1-9][0-9]{0,17}$`; status must be a valid enum case; reason ≤ 500 chars.
- **Errors:** `display_errors` off, logs to stderr, envelope for JSON, generic HTML error page.
- **Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, basic CSP.

### Task 4.1: Skeleton, router, DB, error handling
- **Commit:** `feat(php): scaffold front controller, router and pdo`

### Task 4.2: Authentication (JWT verification, login via Django, session, CSRF)
- **Commit:** `feat(php): add jwt verification and session login via django`

### Task 4.3: Repositories (scoped customer query 🔒 owner-implemented)

- The agent implements `ServiceRepository`. In `CustomerRepository::findVisible(int $id, AuthContext $auth): ?array`, the SQL and parameter binding are left as `TODO(human)`.
- Prepared tests include an injection attempt (`1 OR 1=1`, rejected by validation) and a scoping test.

### Task 4.4: Status change

- Runs inside a PDO transaction:
  1. `SELECT status FROM services WHERE id = :id FOR UPDATE` (auth-scoped).
  2. `ServiceStatus::canTransitionTo()`.
  3. `UPDATE services SET status = :s, updated_at = now() WHERE id = :id`.
  4. `INSERT INTO service_status_logs (..., source) VALUES (..., 'php_module')`.
  5. Commit.
- Runs as the `php_module` role, so the database itself prevents anything beyond these statements.
- **Commit:** `feat(php): add transactional status change with audit log`

### Task 4.5: Pages + JSON API

- `customer.php`: info card, services table, suspend/activate forms (CSRF), flash messages, about 100 lines of responsive CSS.
- JSON routes per 3.6.
- **Commit:** `feat(php): add customer services page and json api`

### Task 4.6: Tests, container image, README

- PHPUnit: validator, enum transitions, JWT verifier (valid / expired / wrong alg / tampered), repositories against a test DB, CSRF.
- `phpstan` level 6 clean.
- Docker: `php:8.3-apache`, `pdo_pgsql`, `composer install --no-dev`, document root `public/`, `expose_php=Off`.
- **Commits:** `test(php): …`, `build(php): add dockerfile and docs`

**Merge `phase/4-php` → `dev`.**

---

## 9. Phase 5: Integration, Compose, CI

**Branch:** `phase/5-integration` · Sole owner of shared root files during this phase

### Task 5.1: Full stack in Compose

- Services `db`, `backend`, `frontend`, `health`, `php` per 3.1; `depends_on: condition: service_healthy`; healthchecks everywhere.
- JWT keys as compose **secrets** from `./secrets/*.pem`; the PHP module gets the public key only.
- A one-shot `seed` service (profile `seed`), or `make seed`.
- Only the needed ports are published; `restart: unless-stopped`.
- **Verify** from a fresh clone: `make env keys up seed` brings all five services to healthy within ~2 minutes.
- **Commit:** `build: compose full stack with healthchecks and secrets`

### Task 5.2: Cross-service smoke test

`scripts/smoke.sh` (curl + `jq`), run with `make smoke`:
1. Log in as staff via Django.
2. Create a customer and a service; suspend the service via Django.
3. The Go service reports `suspended` for that id.
4. Reactivate it through the PHP JSON API with the same token.
5. The Django status history shows 2 entries, with sources `api` and `php_module`.
6. A customer token gets 404 for another customer in both Django and PHP.

The script exits non-zero on any mismatch.
- **Commit:** `test: add cross-service smoke test`

### Task 5.3: CI

`.github/workflows/ci.yml`, with `paths` filters:
- **backend:** postgres service container, `uv sync`, `ruff check`, `ruff format --check`, `makemigrations --check`, `pytest`.
- **frontend:** `npm ci`, lint, `lint:rtl`, typecheck, test, build.
- **go:** `gofmt -l` (empty), `go vet`, `go test -race`.
- **php:** `composer install`, `phpstan`, `phpunit` (postgres service), SQL grep guard.
- **secrets:** `gitleaks`.
- **Commit:** `ci: add per-component pipelines`

**Merge `phase/5-integration` → `dev`.**

---

## 10. Phase 6: Documentation

**Branch:** `phase/6-docs`

### Task 6.1: `README.md`

1. Overview and component diagram (Mermaid).
2. Prerequisites (Docker, Make; optional local toolchains).
3. **Quick start:** `make env keys up seed`, then the URLs and seeded accounts (referencing `.env`, not hard-coded values).
4. Service URLs (frontend, API docs, Django admin, status service, PHP module).
5. Running tests per component and `make smoke`.
6. Repository layout.
7. Security overview (secrets, roles, JWT).
8. Links to `docs/*`.

### Task 6.2: `docs/ERD.md`

A Mermaid `erDiagram` of the four tables. Explain the relationships (user 1 ↔ 0..1 customer, customer 1 ↔ N services, service 1 ↔ N status logs) and the delete behaviors (PROTECT / CASCADE / SET NULL) with their reasons.

### Task 6.3: `docs/ARCHITECTURE.md`

- Component diagram; request flows (login via BFF, status change via Django, status change via PHP).
- Summary of key decisions, linking to `DECISIONS.md`.
- Section headings for the maintainer to write (agents leave them as `<!-- maintainer -->`):
  - Data model and relationships
  - Scaling to 100k+ customers
  - Tenant data isolation
  - Diagnosing slow API requests

### Task 6.4: `docs/API.md`

Authentication flow, a curl example per endpoint, the error code table, and a link to `/api/docs/`.

### Task 6.5: `docs/CONTRIBUTING.md`

- Branching, commit conventions, PR checklist.
- **Extension recipes** (step by step, with the files touched in each component):
  - Add a service status (e.g. terminal `terminated`): enum, transition map, CHECK constraint migration, PHP enum, badge, translations, tests.
  - Add a field to services (e.g. `monthly_price`): model → migration → serializer → form → table → translations.
  - Add a list filter (e.g. `created_after`).
  - Add a staff-only update endpoint (e.g. `PATCH /customers/{id}/`).
  - Add a route alias to the status service (e.g. `GET /health/services/{id}`).
  - Add a UI language.

### Task 6.6: `docs/DEVELOPMENT.md`

Running each component without Docker, useful Make targets, debugging tips (logs, request IDs, `psql`), and the development tooling used on the project, including AI-assisted development (tools, what they were used for, how output was reviewed).

**Merge `phase/6-docs` → `dev`.**

---

## 11. Release checklist

- [ ] A fresh clone starts with `make env keys up seed`.
- [ ] `make test` and `make smoke` pass; CI is green.
- [ ] `gitleaks detect` is clean; no real credentials in history.
- [ ] The permission matrix covers every endpoint × role.
- [ ] No debug leftovers (`print`, `console.log`, `var_dump`) or commented-out code.
- [ ] All components return the same error envelope.
- [ ] The frontend is checked in `en` and `fa` at 375 / 768 / 1280 px.
- [ ] Full-repository code review done; findings fixed or recorded in `DECISIONS.md`.
- [ ] Docs are current (README, ARCHITECTURE, API, CONTRIBUTING).

**Release (maintainer):**

```bash
git switch main
git merge --no-ff dev -m "release: v1.0.0"
git tag -a v1.0.0 -m "v1.0.0"
```

---

## 12. Working with coding agents

**Task prompt template:**

```
You are implementing Task <N.M> of docs/IMPLEMENTATION_PLAN.md in the repository at <path>.
Read sections 0–3 first; they are binding.
Scope: only the files and directories named in the task.
Done means: the deliverables exist, the Verify commands pass, and the work is committed on
<branch> (created from dev; never commit to dev or main directly) using Conventional Commits,
with no attribution lines (see 0.6).
For 🔒 owner-implemented tasks: create only the stub (exactly one TODO(human) marker), the
wiring and the tests, then stop and report.
If a section 3 contract looks wrong or insufficient, stop and report instead of diverging.
Finish with: files changed, commands run and their results, open questions.
```

**Execution order:**

| Step | Parallel streams | Tasks |
|---|---|---|
| 1 | 1 | 0.0 → 0.3 |
| 2 | 1 | 1.1 → 1.4 |
| 3 | 4 (separate worktrees/branches) | A: 1.5–1.10 · B: 2.1–2.8 · C: 3.1–3.5 · D: 4.1–4.6 |
| 4 | 1 | 5.1 → 5.3 |
| 5 | 1 | 6.1 → 6.6 |
| 6 | 1 | Full-repository review against section 11 |
| 7 | maintainer | 🔒 tasks (as they come up), ARCHITECTURE sections, release |

**Review points** (pause for maintainer review before continuing):

- After 1.2: the schema matches 3.2.
- After 1.4: the error envelope is final (every component copies it).
- After 2.2: `en`/`fa` screenshots of the shell, before pages are built on it.
- After each 🔒 task.
- After 5.2: the smoke test passes.
