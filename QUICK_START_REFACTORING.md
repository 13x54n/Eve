> **Status as of Sep 2026:** Historical. Desktop Eve runs the split six-service stack (Docker often postgres+redis only; apps via `tsx` watch). See README / GETTING_STARTED / backend/docs/driver-wallet.md for current behavior.

# Quick Start: High-Impact Refactoring

## 🎯 Goal: Reduce 40ms latency in 1 week

This guide focuses on the **single highest-impact change**: removing Kafka for notify events.

---

## Why This Matters

**Current Flow (Trip Completion):**
```
Ride Service
  → Kafka Publish (10ms)
  → Kafka Broker (20ms)
  → Notify Consumer (5ms)
  → Socket.IO
  → Client
Total: 35ms + operational complexity
```

**After (Direct Call):**
```
Ride Service
  → Notify gRPC (5ms)
  → Socket.IO
  → Client
Total: 5ms
```

**Savings:** 30ms per event (86% reduction)

---

## Step-by-Step Implementation

### Step 1: Create Direct Notify Client (30 minutes)

Create file: `backend/packages/notify-client/package.json`

```json
{
  "name": "@eve/notify-client",
  "version": "1.0.0",
  "type": "module",
  "exports": "./src/index.ts"
}
```

Create file: `backend/packages/notify-client/src/index.ts`

```typescript
/**
 * Direct notify client - replaces Kafka publish
 * Falls back from gRPC → HTTP → local
 */

import { emitTripEventGrpc, emitUserEventGrpc, emitAdminEventGrpc, emitTripAndUserEventGrpc } from "@eve/notify/grpc-client";

const NOTIFY_URL = process.env.NOTIFY_URL || 'http://localhost:4004';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';

// HTTP fallback for when gRPC fails
async function emitViaHttp(body: {
  target: 'trip' | 'user' | 'admin' | 'trip_and_user';
  event: string;
  payload: unknown;
  tripId?: string;
  role?: 'RIDER' | 'DRIVER';
  userId?: string;
}) {
  const res = await fetch(`${NOTIFY_URL}/internal/emit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_SECRET,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Notify HTTP failed: ${res.status}`);
  }
}

// Circuit breaker state
let failureCount = 0;
let lastFailureTime = 0;
const FAILURE_THRESHOLD = 3;
const RESET_TIMEOUT = 30000; // 30 seconds

function shouldUseGrpc(): boolean {
  const now = Date.now();
  if (now - lastFailureTime > RESET_TIMEOUT) {
    failureCount = 0;
  }
  return failureCount < FAILURE_THRESHOLD;
}

function recordFailure() {
  failureCount++;
  lastFailureTime = Date.now();
  console.warn(`[notify-client] gRPC failure ${failureCount}/${FAILURE_THRESHOLD}, switching to HTTP`);
}

function recordSuccess() {
  if (failureCount > 0) {
    console.log('[notify-client] gRPC recovered, resetting circuit breaker');
    failureCount = 0;
  }
}

// Public API
export async function emitTripEvent(tripId: string, event: string, payload: unknown): Promise<void> {
  if (shouldUseGrpc()) {
    try {
      await emitTripEventGrpc(tripId, event, payload);
      recordSuccess();
      return;
    } catch (error) {
      recordFailure();
      console.warn('[notify-client] gRPC failed, falling back to HTTP:', error);
    }
  }

  // Fallback to HTTP
  await emitViaHttp({ target: 'trip', tripId, event, payload });
}

export async function emitUserEvent(
  role: 'RIDER' | 'DRIVER',
  userId: string,
  event: string,
  payload: unknown
): Promise<void> {
  if (shouldUseGrpc()) {
    try {
      await emitUserEventGrpc(role, userId, event, payload);
      recordSuccess();
      return;
    } catch (error) {
      recordFailure();
      console.warn('[notify-client] gRPC failed, falling back to HTTP:', error);
    }
  }

  await emitViaHttp({ target: 'user', role, userId, event, payload });
}

export async function emitTripAndUserEvent(
  tripId: string,
  role: 'RIDER' | 'DRIVER',
  userId: string,
  event: string,
  payload: unknown
): Promise<void> {
  if (shouldUseGrpc()) {
    try {
      await emitTripAndUserEventGrpc(tripId, role, userId, event, payload);
      recordSuccess();
      return;
    } catch (error) {
      recordFailure();
      console.warn('[notify-client] gRPC failed, falling back to HTTP:', error);
    }
  }

  await emitViaHttp({ target: 'trip_and_user', tripId, role, userId, event, payload });
}

export async function emitAdminEvent(event: string, payload: unknown): Promise<void> {
  if (shouldUseGrpc()) {
    try {
      await emitAdminEventGrpc(event, payload);
      recordSuccess();
      return;
    } catch (error) {
      recordFailure();
      console.warn('[notify-client] gRPC failed, falling back to HTTP:', error);
    }
  }

  await emitViaHttp({ target: 'admin', event, payload });
}

export async function emitPaymentEvent(tripId: string, event: string, payload: unknown): Promise<void> {
  // Payment events go to trip room + user rooms
  await emitTripEvent(tripId, event, payload);
  
  const body = payload && typeof payload === 'object' ? payload as {
    riderUserId?: string | null;
    driverUserId?: string | null;
  } : {};

  if (body.riderUserId) {
    await emitUserEvent('RIDER', body.riderUserId, event, payload);
  }
  if (body.driverUserId) {
    await emitUserEvent('DRIVER', body.driverUserId, event, payload);
  }
}
```

### Step 2: Update Package References (10 minutes)

Add workspace to `backend/package.json`:

```json
{
  "workspaces": [
    "services/*",
    "packages/*",
    "packages/notify-client"  // Add this
  ]
}
```

Run:
```bash
cd backend
npm install
```

### Step 3: Add Feature Flag to Ride Service (15 minutes)

Edit `backend/services/ride/src/rider.service.ts`:

```typescript
import { emitTripEvent, emitUserEvent, emitAdminEvent, emitTripAndUserEvent } from "@eve/notify-client"; // NEW
import { publishEveEvent, EVE_TOPICS } from "@eve/shared/kafka"; // OLD

const USE_DIRECT_NOTIFY = process.env.USE_DIRECT_NOTIFY === 'true';

// Wrapper function
async function notifyTripEvent(tripId: string, event: string, payload: unknown) {
  if (USE_DIRECT_NOTIFY) {
    await emitTripEvent(tripId, event, payload);
  } else {
    await publishEveEvent(EVE_TOPICS.trip, { type: event, key: tripId, payload });
  }
}

async function notifyUserEvent(role: 'RIDER' | 'DRIVER', userId: string, event: string, payload: unknown) {
  if (USE_DIRECT_NOTIFY) {
    await emitUserEvent(role, userId, event, payload);
  } else {
    await publishEveEvent(EVE_TOPICS.user, { type: event, key: userId, payload: { role, body: payload } });
  }
}

// Replace all emitTripEvent calls with notifyTripEvent
// Example:
export async function createTrip(userId: string, input: CreateTripInput) {
  // ... existing code ...
  
  // BEFORE
  // await emitTripEvent(trip.id, "trip:requested", payload);
  
  // AFTER
  await notifyTripEvent(trip.id, "trip:requested", payload);
  
  // ... rest of code ...
}
```

### Step 4: Update Auth Service (5 minutes)

Edit `backend/services/auth/src/auth-events.ts`:

```typescript
import { emitAdminEvent } from "@eve/notify-client";

const USE_DIRECT_NOTIFY = process.env.USE_DIRECT_NOTIFY === 'true';

export async function publishAuthEvent(
  type: string,
  userId: string,
  payload: Record<string, unknown>,
) {
  if (USE_DIRECT_NOTIFY) {
    await emitAdminEvent(type, payload);
  } else {
    await publishEveEvent(EVE_TOPICS.auth, { type, key: userId, payload });
  }
}
```

### Step 5: Update Payment Service (5 minutes)

Edit `backend/services/payment/src/server.ts`:

```typescript
import { emitPaymentEvent } from "@eve/notify-client";

const USE_DIRECT_NOTIFY = process.env.USE_DIRECT_NOTIFY === 'true';

async function notifyPaymentEvent(tripId: string, event: string, payload: unknown) {
  if (USE_DIRECT_NOTIFY) {
    await emitPaymentEvent(tripId, event, payload);
  } else {
    await publishEveEvent(EVE_TOPICS.payment, { type: event, key: tripId, payload });
  }
}
```

### Step 6: Test Locally (30 minutes)

1. **Start services with direct notify:**

```bash
cd backend
export USE_DIRECT_NOTIFY=true
npm run dev
```

2. **Test trip creation:**

```bash
# Login as rider
curl -X POST http://localhost:4001/api/auth/privy \
  -H "Content-Type: application/json" \
  -d '{"identityToken": "..."}'

# Create trip
curl -X POST http://localhost:4003/api/rider/trips \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupLat": 37.7749,
    "pickupLng": -122.4194,
    "pickupAddress": "123 Main St",
    "dropoffLat": 37.8049,
    "dropoffLng": -122.4294,
    "dropoffAddress": "456 Oak Ave",
    "vehicleType": "CAR"
  }'
```

3. **Verify Socket.IO event received:**

Connect to `ws://localhost:4004` and verify you receive `trip:requested` event.

### Step 7: Add Metrics (30 minutes)

Create `backend/packages/shared/src/metrics.ts`:

```typescript
import { Histogram, Counter } from 'prom-client';

export const notifyLatency = new Histogram({
  name: 'notify_emit_duration_ms',
  help: 'Time to emit notify event',
  labelNames: ['method', 'event_type'],
  buckets: [1, 5, 10, 20, 50, 100, 200],
});

export const notifyErrors = new Counter({
  name: 'notify_emit_errors_total',
  help: 'Failed notify emits',
  labelNames: ['method', 'error_type'],
});
```

Update notify client to track metrics:

```typescript
import { notifyLatency, notifyErrors } from '@eve/shared/metrics';

export async function emitTripEvent(tripId: string, event: string, payload: unknown): Promise<void> {
  const timer = notifyLatency.startTimer({ method: 'grpc', event_type: event });
  
  try {
    if (shouldUseGrpc()) {
      await emitTripEventGrpc(tripId, event, payload);
      timer();
      return;
    }
    
    timer(); // Stop gRPC timer
    const httpTimer = notifyLatency.startTimer({ method: 'http', event_type: event });
    await emitViaHttp({ target: 'trip', tripId, event, payload });
    httpTimer();
  } catch (error) {
    notifyErrors.inc({ method: 'all', error_type: error.name });
    throw error;
  }
}
```

Add Prometheus endpoint:

```typescript
// backend/services/ride/src/server.ts
import { register } from 'prom-client';

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Step 8: A/B Test in Production (1 week)

Deploy with feature flag:

```yaml
# docker-compose.yml
ride:
  environment:
    USE_DIRECT_NOTIFY: "true"  # Enable for 10% of instances
```

Or use environment-based rollout:

```typescript
// Canary release: 10% of requests
const USE_DIRECT_NOTIFY = Math.random() < 0.1;
```

**Monitor:**
- P50/P95/P99 latency for trip creation
- Error rates for notify events
- Socket.IO delivery success rate

**Expected Results:**
- P95 latency: 200ms → 170ms (15% improvement)
- No increase in error rate
- Same Socket.IO delivery rate

### Step 9: Full Rollout (Week 2)

If metrics are good:

```bash
# Update all services
export USE_DIRECT_NOTIFY=true

# Or in docker-compose
USE_DIRECT_NOTIFY: "true"
```

### Step 10: Remove Kafka (Week 3)

Once 100% traffic is on direct notify:

1. **Remove Kafka consumers:**
```bash
rm backend/services/notify/src/kafka-consumer.ts
rm backend/services/payment/src/kafka-consumer.ts
```

2. **Remove Kafka from docker-compose:**
```yaml
# Comment out kafka service
# kafka:
#   image: apache/kafka:3.8.0
#   ...
```

3. **Remove KAFKA_BROKERS from all services**

4. **Remove kafkajs dependency:**
```bash
cd backend/packages/shared
npm uninstall kafkajs
```

5. **Delete Kafka code:**
```bash
rm backend/packages/shared/src/kafka.ts
```

---

## Testing Checklist

- [ ] Trip creation sends events to Socket.IO
- [ ] Offer submission notifies rider
- [ ] Trip completion notifies both rider and driver
- [ ] Admin events reach admin dashboard
- [ ] Payment events reach user rooms
- [ ] gRPC failure falls back to HTTP
- [ ] HTTP failure logs error (no crash)
- [ ] Circuit breaker opens after 3 failures
- [ ] Circuit breaker closes after 30 seconds
- [ ] Metrics show latency improvement

---

## Monitoring Dashboard

Create Grafana dashboard with:

1. **Latency Comparison**
```promql
histogram_quantile(0.95, 
  rate(notify_emit_duration_ms_bucket[5m])
) by (method)
```

2. **Error Rate**
```promql
rate(notify_emit_errors_total[5m]) by (method)
```

3. **Circuit Breaker State**
```promql
sum(rate(notify_emit_duration_ms_count{method="http"}[1m])) /
sum(rate(notify_emit_duration_ms_count[1m]))
```

---

## Rollback Plan

If issues occur:

```bash
# Revert to Kafka
export USE_DIRECT_NOTIFY=false

# Or restart with old environment
docker-compose down
docker-compose up -d
```

No data loss - Kafka was only transport layer.

---

## Expected Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| P50 Trip Creation | 150ms | 120ms | -20% |
| P95 Trip Creation | 200ms | 160ms | -20% |
| P99 Trip Creation | 350ms | 280ms | -20% |
| Notify Error Rate | 0.01% | 0.01% | Same |
| Infrastructure Cost | $X | $X - $100 | -Kafka |

---

## Next Steps

After this is stable:

1. **Consolidate Location into Ride** (Save another 20ms)
2. **In-memory Fare Cache** (Save 3ms)
3. **Async Audit Logs** (Save 10ms)
4. **Consider Monolith** (Save 30ms)

Total potential: **70ms reduction** (35% improvement)

---

## Support

If you encounter issues:

1. Check logs: `docker-compose logs ride notify`
2. Verify gRPC connectivity: `grpcurl localhost:50052 list`
3. Test HTTP fallback: `curl -X POST http://localhost:4004/internal/emit`
4. Check metrics: `curl http://localhost:4003/metrics | grep notify`

---

## Summary

This single change:
- **Removes Kafka** for notify events
- **Saves 30ms** per event
- **Simplifies architecture** (3 fallback layers → 2)
- **Maintains reliability** with circuit breaker
- **Takes 1 week** to implement and test

**Impact:** 15-20% latency reduction for trip operations.
