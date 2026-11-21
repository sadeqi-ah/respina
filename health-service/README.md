# health-service

Go status service for the Cloud Customer Panel. `GET /health` reports the service's own health
and, with `?service_id=N`, the status of a cloud service read from the shared PostgreSQL database.

- Standard library `net/http` + `log/slog`; the only dependency is `github.com/jackc/pgx/v5`.
- Read-only by design: it connects as `health_ro`, which may only `SELECT (id, status) ON services`.
- Internal-network only. It is not published through a public gateway.

## Run locally

```bash
# No database needed: built-in sample data (125 active, 126 suspended)
HEALTH_DATA_SOURCE=memory go run ./cmd/healthsvc

# Against the compose database (from the repo root: make env keys && docker compose up -d db)
HEALTH_DATABASE_URL="postgres://health_ro:change-me-health@localhost:5432/cloudpanel?sslmode=disable" \
  go run ./cmd/healthsvc
```

Docker:

```bash
docker build -t respina-health .
docker run --rm -p 8080:8080 -e HEALTH_DATA_SOURCE=memory respina-health
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `HEALTH_PORT` | `8080` | Listen port (1–65535) |
| `HEALTH_DATA_SOURCE` | `postgres` | `postgres` or `memory` |
| `HEALTH_DATABASE_URL` | none | Required for `postgres`. Use the `health_ro` role. |
| `HEALTH_DB_TIMEOUT` | `2s` | Per-query and connect timeout (Go duration) |

An invalid configuration exits with code 1 and lists every problem at once.

### `memory` or `postgres`

| | `memory` | `postgres` |
|---|---|---|
| Data | fixed samples: 1, 2, 125, 126 | the real `services` table |
| `GET /health` | always healthy | pings the database; 503 if unreachable |
| Use for | local UI work, demos, tests | compose and production |

In `postgres` mode the service starts even while the database is down, and reports that as 503
until the database is reachable.

## API (plan §3.5)

Every response is JSON with `Cache-Control: no-store` and an `X-Request-ID` header (sent by the
caller, or generated). Errors use the shared envelope:
`{"error": {"code", "message", "request_id"}}`.

```bash
curl -s localhost:8080/health
# 200 {"status":"healthy"}

curl -s localhost:8080/health?service_id=125
# 200 {"status":"healthy","service_id":125,"service_status":"active"}

curl -s localhost:8080/health?service_id=abc     # also: 0, -5, 0125, 99999999999999999999
# 400 {"error":{"code":"invalid_service_id",...}}

curl -s localhost:8080/health?service_id=999999
# 404 {"error":{"code":"not_found",...}}

curl -s -i -X POST localhost:8080/health
# 405 with "Allow: GET" and {"error":{"code":"method_not_allowed",...}}

curl -s localhost:8080/nope
# 404 {"error":{"code":"not_found",...}}

# Database unreachable (postgres mode):
# 503 {"status":"unhealthy","error":{"code":"dependency_unavailable",...}}
```

`status` describes this service; `service_status` is the cloud service's status. A `service_id`
must be a plain positive base-10 integer with no sign, spaces or leading zeros, and must appear
exactly once.

## Health check

The image is distroless (no shell, no curl), so the container checks itself with
`healthsvc -healthcheck`. That probes `http://127.0.0.1:$HEALTH_PORT/health` and exits 0 or 1.

## Development

```bash
gofmt -l .                 # must print nothing
go vet ./...
go test -race ./...

# Integration test against the seeded database, as health_ro:
HEALTH_TEST_DATABASE_URL="postgres://health_ro:change-me-health@localhost:5432/cloudpanel?sslmode=disable" \
  go test -race -tags integration ./internal/store/
```

| Path | Purpose |
|---|---|
| `cmd/healthsvc` | wiring, graceful shutdown (10 s), `-healthcheck` probe |
| `internal/config` | environment parsing and validation |
| `internal/store` | `ServiceStore` interface, memory and Postgres implementations |
| `internal/httpapi` | routes, handler, middleware (recover, request ID, access log), responses |
