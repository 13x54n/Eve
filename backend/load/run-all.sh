#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

DURATION="${DURATION:-15s}"
VUS="${VUS:-5}"
AUTH_URL="${AUTH_URL:-http://localhost:4001}"
RIDE_URL="${RIDE_URL:-http://localhost:4003}"
PAYMENT_URL="${PAYMENT_URL:-http://localhost:4006}"
START_RATE="${START_RATE:-50}"
PEAK_RATE="${PEAK_RATE:-400}"

run() {
  echo ""
  echo "=== k6 $* ==="
  set +e
  DURATION="$DURATION" VUS="$VUS" k6 run --quiet \
    -e DURATION="$DURATION" \
    -e VUS="$VUS" \
    -e AUTH_URL="$AUTH_URL" \
    -e RIDE_URL="$RIDE_URL" \
    -e BASE_URL="$RIDE_URL" \
    -e PAYMENT_URL="$PAYMENT_URL" \
    -e LOCATION_URL="${LOCATION_URL:-http://localhost:4002}" \
    -e NOTIFY_URL="${NOTIFY_URL:-http://localhost:4004}" \
    -e ADMIN_URL="${ADMIN_URL:-http://localhost:4005}" \
    -e START_RATE="$START_RATE" \
    -e PEAK_RATE="$PEAK_RATE" \
    "$@"
  local status=$?
  set -e
  if [ "$status" -ne 0 ]; then
    echo "k6 exited $status (continuing remaining scenarios)"
    FAILED=1
  fi
  sleep 1
}

FAILED=0

run load/services-health.js
run load/geo-notify-health.js
run -e BASE_URL="$AUTH_URL" load/auth.js
run load/health.js
run load/payment-wallet.js
run load/admin-dashboard.js

echo ""
echo "=== load:seed (reset leftover SEARCHING trips / geo) ==="
LOAD_COUNT="${LOAD_COUNT:-10}" npm run load:seed || echo "load:seed failed (continuing)"

run --vus "$VUS" --duration "$DURATION" load/presence.js
run --vus "$VUS" --duration "$DURATION" load/search-storm.js
run --vus "$VUS" --duration "$DURATION" load/offer-market.js
run --vus "$VUS" --duration "$DURATION" load/lifecycle.js
run --vus "$VUS" --duration "$DURATION" load/matchmaking-geo.js
run load/capacity.js

echo ""
if [ "${FAILED:-0}" -ne 0 ]; then
  echo "Some microservice load scenarios failed thresholds."
  exit 1
fi
echo "All microservice load scenarios finished."
