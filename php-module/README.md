# php-module

Customer services module for our PHP-based products: shows a customer's services and lets staff
suspend or reactivate them. Plain PHP 8.3 + PDO, no framework, the same style as our existing
WHMCS-style modules.

- **Reads and writes the shared database directly** as the least-privilege `php_module` role
  (ADR-006). It may only `SELECT` customers and services, `UPDATE (status, updated_at)` on
  services, and `INSERT` audit rows.
- **Never handles passwords or issues tokens.** Login goes through Django's token endpoint;
  tokens are verified with the **public** key only (RS256, ADR-004).
- Same role rules (plan §3.3), error envelope (§3.4) and JSON shapes as the Django API.

## Routes (plan §3.6)

| Method | Path | Type | Auth |
|---|---|---|---|
| GET | `/login` | HTML | none |
| POST | `/login` | HTML | CSRF; checks credentials via Django, stores the access token in the session |
| POST | `/logout` | HTML | session + CSRF |
| GET | `/` | HTML | session; customers go to their own page, staff get an ID lookup form |
| GET | `/customers?id=N` | HTML | redirects to `/customers/N` (staff lookup) |
| GET | `/customers/{id}` | HTML | session |
| POST | `/customers/{id}/services/{serviceId}/status` | HTML form | session + CSRF, staff only; redirects back (PRG) |
| GET | `/api/customers/{id}` | JSON | `Authorization: Bearer <jwt>` |
| GET | `/api/customers/{id}/services` | JSON | Bearer |
| POST | `/api/services/{id}/status` | JSON | Bearer, staff only; body `{"status", "reason"?}` |
| GET | `/healthz` | JSON | none; `{"status":"ok"}` or 503 if the database is unreachable |

A customer asking for another customer's data gets **404** (not 403), exactly like Django.

```bash
TOKEN=$(curl -s -X POST localhost:8000/api/v1/auth/token/ -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"change-me-admin"}' | jq -r .access)

curl -s -H "Authorization: Bearer $TOKEN" localhost:8081/api/customers/1
curl -s -H "Authorization: Bearer $TOKEN" localhost:8081/api/customers/1/services
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"suspended","reason":"unpaid"}' localhost:8081/api/services/125/status
```

Error codes beyond the shared table: `csrf_failed` (403, HTML forms), `unsupported_media_type`
(415, JSON body sent with another content type), `parse_error` (400, body isn't a JSON object).

## Configuration

| Variable | Description |
|---|---|
| `PHP_DB_DSN` | e.g. `pgsql:host=db;port=5432;dbname=cloudpanel` |
| `PHP_DB_USER` / `PHP_DB_PASSWORD` | the `php_module` role |
| `JWT_PUBLIC_KEY_PATH_PHP` | path to Django's public key (never the private key) |
| `DJANGO_API_URL_PHP` | e.g. `http://backend:8000` |
| `COOKIE_SECURE` | `true` behind HTTPS: session cookie gets `Secure` |
| `DB_LOCK_TIMEOUT` | max wait for the service row lock in a status change (default `3s`); then `409 service_busy` |

## Security

| Concern | How |
|---|---|
| SQL injection | Prepared statements with bound parameters only; `EMULATE_PREPARES=false`. `bin/sql-guard.sh` fails CI on `query()`/`exec()` with anything but a literal. Path ids must match `^[1-9][0-9]{0,17}$` or the route 404s. |
| Authentication | `firebase/php-jwt` with the algorithm pinned to RS256 (blocks `alg=none` and HS256 key confusion); `exp` checked; refresh tokens rejected. |
| Authorization | Repositories take an `AuthContext` and scope in SQL: `WHERE … AND (:is_staff OR c.id = :own_customer_id)`. Writes are staff-only and checked before any lookup. |
| Database role | `php_module` can't delete, rename, read users or read the audit log. The integration tests prove each of these is refused. |
| XSS | Every template value goes through `e()` (`htmlspecialchars`, `ENT_QUOTES`). CSP: `default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'`. No inline script or style. |
| CSRF | Per-session token in every form, compared with `hash_equals`. |
| Sessions | `HttpOnly`, `SameSite=Lax`, `Secure` via `COOKIE_SECURE`, strict mode, new id on login. |
| Open redirect | Post-login `next` must be `/customers/N`. |
| Errors | `display_errors` off; logs go to stderr with the request id; generic page or envelope for clients. Database outages are 503 `dependency_unavailable`. |

Known limitation: the session stores only Django's 15-minute access token, so users sign in again
after it expires. Proposal: keep the refresh token server-side and refresh transparently.

## Development

There is no local PHP requirement: the `dev` stage of `docker/Dockerfile` has PHP 8.3,
`pdo_pgsql` and Composer, and the source is bind-mounted. Run these from `php-module/`.

```bash
docker build --target dev -t respina-php-dev -f docker/Dockerfile .
docker run --rm -v "$PWD":/app -w /app respina-php-dev composer install
docker run --rm -v "$PWD":/app -w /app respina-php-dev vendor/bin/phpunit --testsuite unit
docker run --rm -v "$PWD":/app -w /app respina-php-dev vendor/bin/phpstan analyse --memory-limit=512M
bin/sql-guard.sh
tests/sql-guard-test.sh
```

Integration tests run against the real schema as `php_module`. They use an owner connection only
to create and remove their own fixture rows. Requires the compose `db`, migrated:

```bash
set -a; . ../.env; set +a
docker run --rm -v "$PWD":/app -w /app --network respina_default \
  -e PHP_TEST_DB_DSN="pgsql:host=db;port=5432;dbname=cloudpanel" \
  -e PHP_TEST_DB_USER="$PHP_DB_USER" -e PHP_TEST_DB_PASSWORD="$PHP_DB_PASSWORD" \
  -e PHP_TEST_OWNER_USER="$POSTGRES_USER" -e PHP_TEST_OWNER_PASSWORD="$POSTGRES_PASSWORD" \
  respina-php-dev vendor/bin/phpunit
```

Production image (`php:8.3-apache`, document root `public/`, `expose_php=Off`, no Composer,
classmap-authoritative autoloader, opcache):

```bash
docker build --target prod -t respina-php -f docker/Dockerfile .
```

## Layout

| Path | Purpose |
|---|---|
| `public/index.php` | front controller: routes, error handling, security headers |
| `src/Http` | `Request`, `Response`, `Router`, `HttpException` |
| `src/Auth` | `JwtVerifier`, `AuthContext`, `DjangoAuthClient` |
| `src/Security` | `Session`, `Csrf` |
| `src/Domain` | `ServiceStatus` (mirror of Django's state machine), `ServiceType` |
| `src/Repository` | scoped SQL: `CustomerRepository`, `ServiceRepository` |
| `src/Validation` | boundary validation with the shared `{field: [{code, message}]}` details |
| `src/Controller` | `PageController` (HTML), `ApiController` (JSON), `AuthController` |
| `templates/` | plain PHP templates; every value escaped with `e()` |
