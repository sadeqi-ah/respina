#!/usr/bin/env bash
# Task 5.2 — cross-service smoke test (plan §9)
# Runs against the full Compose stack on localhost (`make up seed`, then `make smoke`).
set -euo pipefail

DJANGO=${DJANGO_URL:-http://localhost:8000}
GO=${GO_URL:-http://localhost:8080}
PHP=${PHP_URL:-http://localhost:8081}
ENV_FILE=${ENV_FILE:-.env}

die() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "  $*"; }

command -v jq >/dev/null 2>&1 || die "jq is required"

# Credentials come from .env (the same values `make seed` used), not from this file.
env_get() {
  local value
  value=$(grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//') || true
  [ -n "$value" ] || die "$1 is not set in $ENV_FILE"
  printf '%s' "$value"
}
ADMIN_EMAIL=$(env_get SEED_ADMIN_EMAIL)
ADMIN_PASSWORD=$(env_get SEED_ADMIN_PASSWORD)
CUSTOMER_PASSWORD=$(env_get SEED_CUSTOMER_PASSWORD)
CUSTOMER_EMAIL=customer1@example.com # created by `make seed`

# call METHOD URL [TOKEN] [JSON] → prints the body; dies with status and body unless 2xx.
call() {
  local method=$1 url=$2 token=${3:-} data=${4:-} out status body
  local args=(-sS -X "$method" -w $'\n%{http_code}' -H 'Content-Type: application/json')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$data" ] && args+=(-d "$data")
  out=$(curl "${args[@]}" "$url") || die "$method $url: request failed"
  status=${out##*$'\n'}
  body=${out%$'\n'*}
  [[ $status == 2* ]] || die "$method $url → $status: $body"
  printf '%s' "$body"
}

# status_of URL TOKEN → HTTP status only (for the expected-404 checks).
status_of() { curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $2" "$1"; }

login() {
  call POST "$DJANGO/api/v1/auth/token/" "" "$(jq -nc --arg e "$1" --arg p "$2" '{email: $e, password: $p}')" \
    | jq -er '.access' || die "login as $1 returned no access token"
}

# Unique per run, so the script can be repeated against the same database.
tag=$(date +%s)
phone=$(printf '+98919%07d' $((tag % 10000000))) # zero-padded: always a valid 12-digit mobile
email="smoke.${tag}@example.com"

# ---- 1. Staff login -------------------------------------------------------
echo "=== 1. Staff login ==="
token=$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
pass "got token"

# ---- 2. Create customer + service via Django API ---------------------------
echo "=== 2. Create customer + service ==="
customer_id=$(call POST "$DJANGO/api/v1/customers/" "$token" \
  "$(jq -nc --arg e "$email" --arg p "$phone" '{first_name: "Smoke", last_name: "Test", email: $e, phone: $p}')" \
  | jq -er '.id')
svc_id=$(call POST "$DJANGO/api/v1/customers/$customer_id/services/" "$token" \
  '{"name":"smoke-test","service_type":"cloud_server"}' | jq -er '.id')
pass "customer=$customer_id service=$svc_id"

# ---- 3. Suspend via Django API --------------------------------------------
echo "=== 3. Suspend via Django API ==="
call POST "$DJANGO/api/v1/services/$svc_id/status/" "$token" '{"status":"suspended","reason":"smoke test"}' >/dev/null
pass "suspended"

# ---- 4. Go service reports suspended for that id --------------------------
echo "=== 4. Go health check ==="
svc_status=$(call GET "$GO/health?service_id=$svc_id" | jq -r '.service_status')
[ "$svc_status" = "suspended" ] || die "Go reports service_status=$svc_status (expected suspended)"
pass "service_status=suspended"

# ---- 5. Reactivate through the PHP JSON API --------------------------------
echo "=== 5. Reactivate via PHP JSON API ==="
call POST "$PHP/api/services/$svc_id/status" "$token" '{"status":"active","reason":"smoke test reactivate"}' >/dev/null
pass "reactivated"

# ---- 6. Django status history: exactly 2 entries, sources api + php_module -
echo "=== 6. Status history ==="
history=$(call GET "$DJANGO/api/v1/services/$svc_id/status-history/" "$token")
count=$(jq '.count' <<<"$history")
[ "$count" = "2" ] || die "status history count=$count (expected exactly 2)"
sources=$(jq -r '[.results[].source] | sort | join(",")' <<<"$history")
[ "$sources" = "api,php_module" ] || die "status history sources=$sources (expected api,php_module)"
pass "count=2 sources=$sources"

# ---- 7. Customer token gets 404 for another customer -----------------------
# The target is the customer created above: it certainly exists and is not the caller's, so a
# 404 can only mean scoping works (an id that doesn't exist would 404 with scoping broken).
echo "=== 7. Customer 404 for another customer ==="
cust_token=$(login "$CUSTOMER_EMAIL" "$CUSTOMER_PASSWORD")
own_id=$(call GET "$DJANGO/api/v1/auth/me/" "$cust_token" | jq -er '.customer_id')
[ "$own_id" != "$customer_id" ] || die "customer1 unexpectedly owns customer $customer_id"

# Control: the same token can read its own record in both services.
[ "$(status_of "$DJANGO/api/v1/customers/$own_id/" "$cust_token")" = "200" ] || die "Django: customer can't read own record"
[ "$(status_of "$PHP/api/customers/$own_id" "$cust_token")" = "200" ] || die "PHP: customer can't read own record"

code=$(status_of "$DJANGO/api/v1/customers/$customer_id/" "$cust_token")
[ "$code" = "404" ] || die "Django: customer reading customer $customer_id got $code (expected 404)"
pass "Django 404 OK (own record 200)"

code=$(status_of "$PHP/api/customers/$customer_id" "$cust_token")
[ "$code" = "404" ] || die "PHP: customer reading customer $customer_id got $code (expected 404)"
pass "PHP 404 OK (own record 200)"

# ---- Done ------------------------------------------------------------------
echo ""
echo "=== ALL SMOKE TESTS PASSED ==="
