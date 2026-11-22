#!/usr/bin/env bash
# Task 5.2 — cross-service smoke test (plan §9)
# Runs against the full Compose stack on localhost.
set -euo pipefail

DJANGO=http://localhost:8000
GO=http://localhost:8080
PHP=http://localhost:8081

die() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "  $*"; }

command -v jq >/dev/null 2>&1 || die "jq is required"

# Unique suffix so the script is idempotent across repeated runs.
tag=$(date +%s)
suffix=$((tag % 10000000))
phone="+98919${suffix}"
email="smoke.${tag}@example.com"

# ---- 1. Staff login -------------------------------------------------------
echo "=== 1. Staff login ==="
token=$(curl -sf -X POST "$DJANGO/api/v1/auth/token/" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"change-me-admin"}' \
  | jq -r '.access')
[ -n "$token" ] && [ "$token" != "null" ] || die "staff login failed"
pass "got token"

# ---- 2. Create customer + service via Django API ---------------------------
echo "=== 2. Create customer + service ==="
customer=$(curl -sf -X POST "$DJANGO/api/v1/customers/" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d "$(cat <<EOF
{"first_name":"Smoke","last_name":"Test","email":"$email","phone":"$phone"}
EOF
)")
customer_id=$(echo "$customer" | jq -r '.id')
[ "$customer_id" != "null" ] || die "create customer failed: $(echo "$customer" | jq -c .)"

svc=$(curl -sf -X POST "$DJANGO/api/v1/customers/$customer_id/services/" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d '{"name":"smoke-test","service_type":"cloud_server"}')
svc_id=$(echo "$svc" | jq -r '.id')
[ "$svc_id" != "null" ] || die "create service failed: $(echo "$svc" | jq -c .)"
pass "customer=$customer_id service=$svc_id"

# ---- 3. Suspend via Django API --------------------------------------------
echo "=== 3. Suspend via Django API ==="
curl -sf -X POST "$DJANGO/api/v1/services/$svc_id/status/" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d '{"status":"suspended","reason":"smoke test"}' > /dev/null \
  || die "suspend via django failed"
pass "suspended"

# ---- 4. Go service reports suspended for that id --------------------------
echo "=== 4. Go health check ==="
svc_status=$(curl -sf "$GO/health?service_id=$svc_id" | jq -r '.service_status')
[ "$svc_status" = "suspended" ] || die "Go reports service_status=$svc_status (expected suspended)"
pass "service_status=suspended"

# ---- 5. Reactivate through the PHP JSON API --------------------------------
echo "=== 5. Reactivate via PHP JSON API ==="
curl -sf -X POST "$PHP/api/services/$svc_id/status" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d '{"status":"active","reason":"smoke test reactivate"}' > /dev/null \
  || die "reactivate via php failed"
pass "reactivated"

# ---- 6. Django status history shows 2 entries, sources api + php_module ----
echo "=== 6. Status history ==="
history=$(curl -sf "$DJANGO/api/v1/services/$svc_id/status-history/" \
  -H "Authorization: Bearer $token")
count=$(echo "$history" | jq '.count')
[ "$count" -ge 2 ] || die "status history count=$count (expected >=2)"
sources=$(echo "$history" | jq -r '[.results[].source] | sort | unique | join(",")')
[ "$sources" = "api,php_module" ] || die "status history sources=$sources (expected api,php_module)"
pass "count=$count sources=$sources"

# ---- 7. Customer token gets 404 for another customer -----------------------
echo "=== 7. Customer 404 for other customer ==="
cust_token=$(curl -sf -X POST "$DJANGO/api/v1/auth/token/" \
  -H 'Content-Type: application/json' \
  -d '{"email":"customer1@example.com","password":"change-me-customer"}' \
  | jq -r '.access')
[ -n "$cust_token" ] && [ "$cust_token" != "null" ] || die "customer login failed"

code=$(curl -s -o /dev/null -w '%{http_code}' \
  "$DJANGO/api/v1/customers/2/" \
  -H "Authorization: Bearer $cust_token")
[ "$code" = "404" ] || die "Django 404 for other customer (got $code)"
pass "Django 404 OK"

code=$(curl -s -o /dev/null -w '%{http_code}' \
  "$PHP/api/customers/2" \
  -H "Authorization: Bearer $cust_token")
[ "$code" = "404" ] || die "PHP 404 for other customer (got $code)"
pass "PHP 404 OK"

# ---- Done ------------------------------------------------------------------
echo ""
echo "=== ALL SMOKE TESTS PASSED ==="