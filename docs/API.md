# API

The Django REST API is the system's main interface. Interactive documentation generated from the
code lives at **http://localhost:8000/api/docs/** (Swagger UI) and **/api/schema/** (OpenAPI 3).
The Go status service and the PHP module's JSON API are covered at the end.

Conventions: base path `/api/v1`, JSON bodies, ISO-8601 UTC timestamps, integer ids, trailing
slashes on Django paths.

## Authentication

Django issues **RS256 JWTs**: a 15-minute access token and a 7-day refresh token. Send the access
token as `Authorization: Bearer <access>`. Tokens carry `role` (`staff` | `customer`) and
`customer_id` (null for staff).

Refresh tokens are **single-use**: `POST /auth/token/refresh/` returns a new pair and blacklists
the old refresh token, so a stolen one stops working once it has been used
([ADR-012](DECISIONS.md#adr-012-single-use-refresh-tokens-with-refresh-shared-in-the-bff)). Login
and refresh are rate-limited (`429 throttled`, `Retry-After` header).

The browser never handles these tokens: the frontend's BFF stores them in httpOnly cookies (see
[ARCHITECTURE.md](ARCHITECTURE.md#login-through-the-bff)). The examples below call Django directly.

```bash
API=http://localhost:8000/api/v1
# Credentials from your .env (see README → Quick start)
EMAIL=$(grep ^SEED_ADMIN_EMAIL= .env | cut -d= -f2-)
PASSWORD=$(grep ^SEED_ADMIN_PASSWORD= .env | cut -d= -f2-)
```

### `POST /auth/token/`: log in

```bash
curl -s -X POST $API/auth/token/ -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
# 200 {"access":"eyJ…","refresh":"eyJ…"}     401 invalid_credentials     429 throttled

TOKEN=$(curl -s -X POST $API/auth/token/ -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r .access)
```

### `POST /auth/token/refresh/`: rotate tokens

```bash
curl -s -X POST $API/auth/token/refresh/ -H 'Content-Type: application/json' \
  -d '{"refresh":"<refresh token>"}'
# 200 {"access":"…","refresh":"…"}   the old refresh token is now blacklisted
# 401 token_invalid                   expired, malformed or already used
```

### `GET /auth/me/`: who am I

```bash
curl -s $API/auth/me/ -H "Authorization: Bearer $TOKEN"
# 200 {"id":1,"email":"admin@example.com","role":"staff","customer_id":null}
```

## Customers

Staff see every customer. A customer sees only their own record; anyone else's answers **404**,
not 403, so ids can't be probed.

### `GET /customers/`: list

Query: `page`, `page_size` (max 100), `search` (first name, last name, email, phone),
`ordering` (`created_at`, `-created_at`, `last_name`, `-last_name`; default `-created_at`).

```bash
curl -s "$API/customers/?page=1&page_size=20&search=ali&ordering=last_name" \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "count": 2, "page": 1, "page_size": 20, "total_pages": 1,
  "results": [
    {
      "id": 12, "first_name": "Ali", "last_name": "Rezaei", "full_name": "Ali Rezaei",
      "email": "ali@example.com", "phone": "+989121234567",
      "services_count": 3, "created_at": "2026-11-21T10:00:00Z"
    }
  ]
}
```

### `POST /customers/`: create (staff)

The phone accepts `09121234567`, `+989121234567`, `00989121234567`, separators, and Persian
digits; it's stored as E.164. Email and phone must be unique (email ignoring case).

```bash
curl -s -X POST $API/customers/ -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"first_name":"Sara","last_name":"Ahmadi","email":"sara@example.com","phone":"0912 123 4567"}'
# 201 customer       400 validation_error (e.g. details.email[0].code = "unique")       403 (customer token)
```

### `GET /customers/{id}/`: retrieve

```bash
curl -s $API/customers/12/ -H "Authorization: Bearer $TOKEN"
# 200 customer       404 missing or not yours
```

### `GET /customers/{id}/services/`: a customer's services

Query: `page`, `page_size`, `status` (`active` | `suspended`),
`service_type` (`cloud_server`, `vps`, `dedicated_server`, `object_storage`, `managed_database`).

```bash
curl -s "$API/customers/12/services/?status=active&service_type=vps" -H "Authorization: Bearer $TOKEN"
# 200 page of services       400 validation_error (unknown status/type)       404 not yours
```

### `POST /customers/{id}/services/`: create a service (staff)

New services start `active`. Names are unique per customer, ignoring case.

```bash
curl -s -X POST $API/customers/12/services/ -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"web-prod-1","service_type":"cloud_server"}'
# 201 service       400 validation_error (details.name[0].code = "unique")       403       404
```

## Services

### `GET /services/{id}/`: retrieve

```bash
curl -s $API/services/125/ -H "Authorization: Bearer $TOKEN"
```

```json
{
  "id": 125, "customer_id": 12, "name": "web-prod-1",
  "service_type": "cloud_server", "service_type_display": "Cloud Server",
  "status": "active",
  "created_at": "2026-11-21T10:00:00Z", "updated_at": "2026-11-21T10:00:00Z"
}
```

### `POST /services/{id}/status/`: change status (staff)

`active → suspended` and `suspended → active`. The change and its audit row are written in one
transaction with the service row locked.

```bash
curl -s -X POST $API/services/125/status/ -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"suspended","reason":"Unpaid invoice"}'
# 200 service       409 invalid_status_transition (already in that status)
# 400 validation_error (unknown status, reason > 500 chars)       403       404
```

### `GET /services/{id}/status-history/`: audit trail

Newest first, paginated.

```bash
curl -s $API/services/125/status-history/ -H "Authorization: Bearer $TOKEN"
```

```json
{
  "count": 1, "page": 1, "page_size": 20, "total_pages": 1,
  "results": [
    {
      "id": 7, "from_status": "active", "to_status": "suspended",
      "changed_by_id": 1, "source": "api", "reason": "Unpaid invoice",
      "created_at": "2026-11-21T10:05:00Z"
    }
  ]
}
```

`source` is `api` (Django), `php_module` or `admin` (Django admin, seed).

## Errors

Every non-2xx response from every component uses one envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid input.",
    "details": { "email": [{ "code": "unique", "message": "A customer with this email already exists." }] },
    "request_id": "8f2c1e…"
  }
}
```

`code` is stable and meant for programs; `message` is English and meant for logs. `details` appears
only on validation errors: field name → list of `{code, message}`. Quote `request_id` (also in
the `X-Request-ID` header) when reporting a problem: it appears in every component's logs.

| HTTP | `code` | When |
|---|---|---|
| 400 | `validation_error` | Input failed validation. Field codes include `required`, `blank`, `invalid`, `unique`, `max_length`, `invalid_phone`, `invalid_choice`. |
| 400 | `invalid_service_id` | Go service: `service_id` isn't a positive integer |
| 401 | `not_authenticated` | No token |
| 401 | `token_invalid` | Token expired, malformed, wrongly signed, or a used refresh token |
| 401 | `invalid_credentials` | Wrong email or password at login |
| 403 | `permission_denied` | Authenticated, but the role may not do this (e.g. a customer creating) |
| 403 | `csrf_failed` | Frontend BFF or PHP forms: missing `X-Requested-With` header or CSRF token |
| 404 | `not_found` | Missing, **or not visible to the caller** |
| 405 | `method_not_allowed` | Wrong HTTP method (`Allow` header set) |
| 409 | `invalid_status_transition` | The service already has that status |
| 409 | `conflict` | A uniqueness race the validators couldn't see (concurrent creates) |
| 429 | `throttled` | Too many login/refresh attempts (`Retry-After` header) |
| 500 | `internal_error` | Unexpected failure; no stack trace is ever returned |
| 503 | `dependency_unavailable` | The database (or, from the BFF, Django) is unreachable |

## Go status service

Port 8080. No authentication: it reveals only whether a service id exists and its status.

```bash
curl -s http://localhost:8080/health
# 200 {"status":"healthy"}          503 {"status":"unhealthy","error":{…dependency_unavailable…}}

curl -s 'http://localhost:8080/health?service_id=125'
# 200 {"status":"healthy","service_id":125,"service_status":"active"}
# 400 invalid_service_id (abc, 0, -5, too large)       404 not_found
```

## PHP module JSON API

Port 8081. Same JWTs (verified with the public key), same scoping rules, same envelope.

```bash
PHP=http://localhost:8081
curl -s $PHP/api/customers/12 -H "Authorization: Bearer $TOKEN"            # 200 customer | 404
curl -s $PHP/api/customers/12/services -H "Authorization: Bearer $TOKEN"   # 200 services | 404
curl -s -X POST $PHP/api/services/125/status -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"active","reason":"Paid"}'
# 200 service (audit source "php_module")       409       403 (customer token)       404
```
