# Eve Architecture Refactoring Plan

## Executive Summary

This document outlines a phased approach to reduce latency by 40-80ms per request while maintaining reliability and simplifying the codebase.

**Goals:**
- Reduce P95 latency from ~200ms to ~120ms
- Remove unnecessary complexity (Kafka, multiple protocols)
- Maintain all existing functionality
- Zero downtime migration

---

## Phase 1: Quick Wins (1-2 weeks, ~35ms saved)

### 1.1 Replace Kafka → Notify with Direct Calls

**Current Flow:**
```
Ride Service → Kafka Producer (10ms)
  → Kafka Broker (20ms) 
  → Notify Consumer (5ms)
  → Socket.IO
Total: 35ms + operational complexity
```

**New Flow:**
```
Ride Service → Notify HTTP/gRPC (5ms)
  → Socket.IO
Total: 5ms
```

#### Implementation Steps

**Step 1: Create Unified Notify Client**

File: `backend/packages/notify-client/src/index.ts`

```typescript
import { type EveNotifyUser } from "@eve/shared";

interface NotifyClient {
  emitTripEvent(tripId: string, event: string, payload: unknown): Promise<void>;
  emitUserEvent(role: "RIDER" | "DRIVER", userId: string, event: string, payload: unknown): Promise<void>;
  emitTripAndUserEvent(tripId: string, role: "RIDER" | "DRIVER", userId: string, event: string, payload: unknown): Promise<void>;
  emitAdminEvent(event: string, payload: unknown): Promise<void>;
  emitPaymentEvent(tripId: string, event: string, payload: unknown): Promise<void>;
}

// HTTP implementation (fallback)
class HttpNotifyClient implements NotifyClient {
  constructor(private baseUrl: string, private secret: string) {}
  
  private async emit(body: any) {
    const res = await fetch(`${this.baseUrl}/internal/emit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': this.secret
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Emit failed: ${res.status}`);
  }

  async emitTripEvent(tripId: string, event: string, payload: unknown) {
    await this.emit({ target: 'trip', tripId, event, payload });
  }

  async emitUserEvent(role: "RIDER" | "DRIVER", userId: string, event: string, payload: unknown) {
    await this.emit({ target: 'user', role, userId, event, payload });
  }

  async emitTripAndUserEvent(tripId: string, role: "RIDER" | "DRIVER", userId: string, event: string, payload: unknown) {
    await this.emit({ target: 'trip_and_user', tripId, role, userId, event, payload });
  }

  async emitAdminEvent(event: string, payload: unknown) {
    await this.emit({ target: 'admin', event, payload });
  }

  async emitPaymentEvent(tripId: string, event: string, payload: unknown) {
    await this.emit({ target: 'trip', tripId, event, payload });
  }
}

// gRPC implementation (primary)
class GrpcNotifyClient implements NotifyClient {
  // Use existing gRPC client
  async emitTripEvent(tripId: string, event: string, payload: unknown) {
    await emitTripEventGrpc(tripId, event, payload);
  }
  // ... other methods using gRPC
}

// Circuit breaker wrapper
class ResilientNotifyClient implements NotifyClient {
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly FAILURE_THRESHOLD = 3;
  private readonly RESET_TIMEOUT = 30000; // 30 seconds

  constructor(
    private primary: NotifyClient,
    private fallback: NotifyClient
  ) {}

  private async executeWithFallback<T>(
    operation: (client: NotifyClient) => Promise<T>
  ): Promise<T> {
    const now = Date.now();
    
    // Reset circuit breaker after timeout
    if (now - this.lastFailureTime > this.RESET_TIMEOUT) {
      this.failureCount = 0;
    }

    // Use fallback if circuit is open
    if (this.failureCount >= this.FAILURE_THRESHOLD) {
      console.warn('Notify circuit breaker OPEN, using fallback');
      return operation(this.fallback);
    }

    try {
      const result = await operation(this.primary);
      this.failureCount = 0; // Reset on success
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = now;
      console.warn(`Notify primary failed (${this.failureCount}/${this.FAILURE_THRESHOLD}), using fallback`, error);
      return operation(this.fallback);
    }
  }

  async emitTripEvent(tripId: string, event: string, payload: unknown) {
    await this.executeWithFallback(client => client.emitTripEvent(tripId, event, payload));
  }

  async emitUserEvent(role: "RIDER" | "DRIVER", userId: string, event: string, payload: unknown) {
    await this.executeWithFallback(client => client.emitUserEvent(role, userId, event, payload));
  }

  async emitTripAndUserEvent(tripId: string, role: "RIDER" | "DRIVER", userId: string, event: string, payload: unknown) {
    await this.executeWithFallback(client => client.emitTripAndUserEvent(tripId, role, userId, event, payload));
  }

  async emitAdminEvent(event: string, payload: unknown) {
    await this.executeWithFallback(client => client.emitAdminEvent(event, payload));
  }

  async emitPaymentEvent(tripId: string, event: string, payload: unknown) {
    await this.executeWithFallback(client => client.emitPaymentEvent(tripId, event, payload));
  }
}

// Singleton instance
export const notifyClient = new ResilientNotifyClient(
  new GrpcNotifyClient(),
  new HttpNotifyClient(
    process.env.NOTIFY_URL || 'http://localhost:4004',
    process.env.INTERNAL_SERVICE_SECRET || ''
  )
);

// Export for compatibility
export const emitTripEvent = notifyClient.emitTripEvent.bind(notifyClient);
export const emitUserEvent = notifyClient.emitUserEvent.bind(notifyClient);
export const emitTripAndUserEvent = notifyClient.emitTripAndUserEvent.bind(notifyClient);
export const emitAdminEvent = notifyClient.emitAdminEvent.bind(notifyClient);
export const emitPaymentEvent = notifyClient.emitPaymentEvent.bind(notifyClient);
```

**Step 2: Add Async Event Log (Optional - for audit/replay)**

If you still want event sourcing benefits without Kafka:

File: `backend/packages/db/prisma/schema.prisma`

```prisma
model EventLog {
  id          String   @id @default(cuid())
  type        String   // "trip:completed"
  source      String   // "ride"
  key         String   // trip_id
  payload     Json
  occurredAt  DateTime @default(now())
  processed   Boolean  @default(false)
  
  @@index([type, occurredAt])
  @@index([processed, occurredAt])
  @@map("event_log")
}
```

File: `backend/packages/shared/src/event-logger.ts`

```typescript
import { prisma } from "@eve/db";

export async function logEvent(
  type: string,
  key: string,
  payload: unknown
): Promise<void> {
  // Fire and forget - don't block main flow
  prisma.eventLog.create({
    data: {
      type,
      source: process.env.npm_package_name || 'unknown',
      key,
      payload: payload as any,
    }
  }).catch(err => {
    console.error('Failed to log event:', err);
  });
}
```

**Step 3: Update All Services**

In ride service (`backend/services/ride/src/rider.service.ts`):

```typescript
// BEFORE
import { emitTripEvent } from "@eve/notify";
await publishEveEvent(EVE_TOPICS.trip, { type: "trip:requested", key: tripId, payload });
await emitTripEvent(trip.id, "trip:requested", payload);

// AFTER
import { emitTripEvent } from "@eve/notify-client";
import { logEvent } from "@eve/shared/event-logger";

await emitTripEvent(trip.id, "trip:requested", payload);
await logEvent("trip:requested", trip.id, payload); // Async, optional
```

**Step 4: Remove Kafka Dependencies**

```bash
# Remove Kafka consumers
rm backend/services/notify/src/kafka-consumer.ts
rm backend/services/payment/src/kafka-consumer.ts

# Update package.json
# Remove kafkajs from dependencies in backend/packages/shared/package.json
```

**Step 5: Update Docker Compose**

```yaml
# backend/docker-compose.yml
# Comment out or remove kafka service
# Remove KAFKA_BROKERS env vars from all services
```

#### Testing Strategy

1. **Load Test Before:**
```bash
# Record baseline
k6 run --duration 5m --vus 100 tests/load/trip-creation.js
# Note P95 latency
```

2. **Deploy with Feature Flag:**
```typescript
const USE_KAFKA = process.env.USE_KAFKA === 'true';

if (USE_KAFKA) {
  await publishEveEvent(/* ... */);
} else {
  await emitTripEvent(/* ... */);
}
```

3. **Gradual Rollout:**
- Week 1: 10% traffic to new path
- Week 2: 50% traffic
- Week 3: 100% traffic
- Week 4: Remove Kafka entirely

4. **Monitoring:**
```typescript
// Add metrics
import { Counter, Histogram } from 'prom-client';

const notifyLatency = new Histogram({
  name: 'notify_emit_duration_ms',
  help: 'Time to emit notify event',
  labelNames: ['method'] // 'kafka' or 'direct'
});

const notifyErrors = new Counter({
  name: 'notify_emit_errors_total',
  help: 'Failed notify emits',
  labelNames: ['method', 'fallback']
});
```

#### Expected Impact

- **Latency:** -30ms P95 (Kafka overhead removed)
- **Complexity:** -500 LOC (Kafka client, consumers, fallback logic)
- **Dependencies:** -1 (Apache Kafka)
- **Operational:** Simpler deployment, fewer failure modes

---

### 1.2 Standardize on HTTP for Inter-Service Calls

**Current State:**
- Location: gRPC (primary)
- Notify: Kafka → gRPC → HTTP (three protocols!)
- Payment: HTTP

**Proposed State:**
- Everything: HTTP with JSON
- Keep gRPC only if you measure >20ms improvement in production

#### Why HTTP Wins for Your Scale

**Pros:**
- Universal tooling (curl, Postman, browser)
- Easy debugging (Wireshark, proxy logs)
- Load balancer native support
- No protobuf compilation step
- Smaller learning curve for new devs

**Cons:**
- 10-15ms slower than gRPC (but you save 30ms removing Kafka)

#### Implementation

**Option A: Keep gRPC, Remove Fallbacks**

```typescript
// Simplify to single gRPC call
const drivers = await nearbyDriversGrpc({ pickupLat, pickupLng, vehicleType });
// If it fails, let it fail and return error to client
// Don't hide failures with 3 fallback layers
```

**Option B: Migrate to HTTP, Remove gRPC**

File: `backend/services/location/src/server.ts`

```typescript
// Add HTTP endpoints (keep gRPC running in parallel during migration)
app.post('/internal/nearby-drivers', requireInternalAuth, async (req, res) => {
  const { pickupLat, pickupLng, vehicleType, excludeUserId, matchAllVehicleTypes } = req.body;
  
  const drivers = await nearbyDriversLocal({
    pickupLat,
    pickupLng,
    vehicleType,
    excludeUserId,
    matchAllVehicleTypes
  });
  
  res.json({ drivers });
});

app.post('/internal/nearby-trips', requireInternalAuth, async (req, res) => {
  const { driverLat, driverLng, vehicleType, driverId } = req.body;
  
  const trips = await nearbyTripsLocal({
    driverLat,
    driverLng,
    vehicleType,
    driverId
  });
  
  res.json({ trips });
});
```

File: `backend/packages/location-client/src/index.ts`

```typescript
import { z } from 'zod';

const LOCATION_URL = process.env.LOCATION_URL || 'http://localhost:4002';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';

interface NearbyDriversRequest {
  pickupLat: number;
  pickupLng: number;
  vehicleType: string;
  excludeUserId?: string;
  matchAllVehicleTypes?: boolean;
}

export async function nearbyDrivers(input: NearbyDriversRequest) {
  const res = await fetch(`${LOCATION_URL}/internal/nearby-drivers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_SECRET,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Location service error: ${res.status}`);
  }

  const data = await res.json();
  return data.drivers;
}

export async function nearbyTrips(input: {
  driverLat: number;
  driverLng: number;
  vehicleType: string;
  driverId: string;
}) {
  const res = await fetch(`${LOCATION_URL}/internal/nearby-trips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_SECRET,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Location service error: ${res.status}`);
  }

  const data = await res.json();
  return data.trips;
}
```

**Gradual Migration:**
1. Add HTTP endpoints to location service
2. Update ride service to use HTTP client
3. Run both protocols for 1 week
4. Monitor latency difference (expect <10ms)
5. Remove gRPC if difference is negligible

---

### 1.3 Add Request Tracing

**Problem:** You have no visibility into where latency is coming from.

**Solution:** OpenTelemetry for distributed tracing.

File: `backend/packages/shared/src/tracing.ts`

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const serviceName = process.env.npm_package_name || 'eve-service';

export function initTracing() {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
    traceExporter: new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  
  process.on('SIGTERM', () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
}
```

Add to each service's `server.ts`:

```typescript
import { initTracing } from '@eve/shared/tracing';

if (process.env.ENABLE_TRACING === 'true') {
  initTracing();
}
```

Add Jaeger to docker-compose:

```yaml
jaeger:
  image: jaegertracing/all-in-one:latest
  ports:
    - "16686:16686"  # UI
    - "14268:14268"  # Collector
  environment:
    COLLECTOR_OTLP_ENABLED: true
```

**Result:** Visual flamegraphs showing exact latency breakdown per service/database/Redis call.

---

## Phase 2: Medium Wins (2-4 weeks, ~20ms saved)

### 2.1 Consolidate Ride + Location Services

**Rationale:**
- Every trip operation calls location service
- Network hop adds 15-30ms
- Location logic is simple (H3 queries)
- No independent scaling needed yet

#### Implementation

**Step 1: Move Location Logic into Ride Service**

```bash
# Copy location service code into ride service
cp -r backend/services/location/src/h3.ts backend/services/ride/src/
cp -r backend/services/location/src/matching.ts backend/services/ride/src/
```

File: `backend/services/ride/src/location.ts`

```typescript
import { prisma } from "@eve/db";
import { cache } from "@eve/shared";
import { cellToLatLng, latLngToCell, gridDisk } from "h3-js";

const MATCH_RADIUS_KM = 15;
const H3_RESOLUTION = 8;

// Direct implementation - no network call
export async function nearbyDrivers(input: {
  pickupLat: number;
  pickupLng: number;
  vehicleType: string;
  excludeUserId?: string;
}): Promise<Array<{ id: string; userId: string; distanceKm: number }>> {
  const cell = latLngToCell(input.pickupLat, input.pickupLng, H3_RESOLUTION);
  const radius = Math.ceil((MATCH_RADIUS_KM / 0.46) * 1.5); // H3 res 8 edge length
  const cells = gridDisk(cell, radius);

  // Query Redis for all drivers in these cells
  const redis = cache.getClient();
  const driverIds = new Set<string>();
  
  for (const cell of cells) {
    const key = `h3:drivers:${input.vehicleType}:${cell}`;
    const members = await redis.sMembers(key);
    members.forEach(id => driverIds.add(id));
  }

  if (driverIds.size === 0) return [];

  // Validate with PostgreSQL
  const drivers = await prisma.driverProfile.findMany({
    where: {
      id: { in: Array.from(driverIds) },
      presence: 'ONLINE',
      approvalStatus: 'APPROVED',
      ...(input.excludeUserId ? { userId: { not: input.excludeUserId } } : {}),
    },
    select: {
      id: true,
      userId: true,
      latitude: true,
      longitude: true,
    },
  });

  // Calculate distances and filter
  const results = drivers
    .map(driver => ({
      ...driver,
      distanceKm: haversineDistance(
        input.pickupLat,
        input.pickupLng,
        driver.latitude!,
        driver.longitude!
      ),
    }))
    .filter(d => d.distanceKm <= MATCH_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return results;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

**Step 2: Update Ride Service to Use Local Functions**

File: `backend/services/ride/src/rider.service.ts`

```typescript
// BEFORE
import { nearbyDriversClient } from "@eve/location";
const drivers = await nearbyDriversClient({ pickupLat, pickupLng, vehicleType });

// AFTER
import { nearbyDrivers } from "./location.js";
const drivers = await nearbyDrivers({ pickupLat, pickupLng, vehicleType });
```

**Step 3: Keep Location Service for Driver GPS Updates**

Driver apps still POST to `/api/driver/presence` which updates Redis H3 index.

Option A: Keep as separate service (lightweight, just GPS endpoints)
Option B: Move into ride service (fully consolidated)

**Expected Impact:**
- Remove 1 service (location can be deprecated)
- Save 15-30ms per trip creation (no network hop)
- Simplified deployment

---

### 2.2 In-Memory Fare Config Cache

**Current:** Redis cache with 24hr TTL (1-3ms per query)
**Proposed:** In-memory Map with 1hr TTL (0ms, zero latency)

File: `backend/packages/db/src/fare-cache.ts`

```typescript
import { type FareConfig } from "./fare.js";

interface CacheEntry {
  config: FareConfig;
  expiresAt: number;
}

class InMemoryFareCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 3600 * 1000; // 1 hour

  get(city: string, vehicleType: string): FareConfig | null {
    const key = `${city}:${vehicleType}`;
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.config;
  }

  set(city: string, vehicleType: string, config: FareConfig): void {
    const key = `${city}:${vehicleType}`;
    this.cache.set(key, {
      config,
      expiresAt: Date.now() + this.TTL,
    });
  }

  invalidate(city: string, vehicleType: string): void {
    const key = `${city}:${vehicleType}`;
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}

export const fareCache = new InMemoryFareCache();

// Invalidate via notify events when admin updates pricing
import { emitAdminEvent } from "@eve/notify-client";

export async function invalidateFareCache(city: string, vehicleType: string) {
  fareCache.invalidate(city, vehicleType);
  
  // Broadcast to all ride service instances
  await emitAdminEvent("fare:config:invalidated", { city, vehicleType });
}
```

File: `backend/services/ride/src/server.ts`

```typescript
import { io } from "./socket-server.js";
import { fareCache } from "@eve/db/fare-cache";

// Listen for invalidation events
io.on("fare:config:invalidated", (data: { city: string; vehicleType: string }) => {
  fareCache.invalidate(data.city, data.vehicleType);
});
```

**Expected Impact:**
- Save 1-3ms per fare calculation
- Zero external dependency (no Redis query)
- Works across multiple ride service instances

---

### 2.3 Async Database Writes (Non-Critical Data)

**Pattern:** Write-Behind Caching

File: `backend/packages/shared/src/async-writer.ts`

```typescript
type WriteOperation = () => Promise<void>;

class AsyncWriter {
  private queue: WriteOperation[] = [];
  private processing = false;
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL = 1000; // 1 second

  constructor() {
    setInterval(() => this.flush(), this.FLUSH_INTERVAL);
  }

  enqueue(operation: WriteOperation): void {
    this.queue.push(operation);
    
    if (this.queue.length >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const batch = this.queue.splice(0, this.BATCH_SIZE);
    
    try {
      await Promise.allSettled(batch.map(op => op()));
    } catch (err) {
      console.error('Async write batch failed:', err);
    } finally {
      this.processing = false;
    }
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }
}

export const asyncWriter = new AsyncWriter();
```

**Use Cases:**

1. **Audit Logs** (non-critical):
```typescript
// BEFORE (blocks response)
await prisma.auditLog.create({ data: { userId, action, details } });
return res.json({ success: true });

// AFTER (async)
asyncWriter.enqueue(() => 
  prisma.auditLog.create({ data: { userId, action, details } })
);
return res.json({ success: true }); // Immediate response
```

2. **Driver Stats** (can be eventually consistent):
```typescript
asyncWriter.enqueue(() =>
  prisma.driverProfile.update({
    where: { id: driverId },
    data: { totalTrips: { increment: 1 } }
  })
);
```

3. **Event Logs**:
```typescript
asyncWriter.enqueue(() =>
  prisma.eventLog.create({ data: { type, key, payload } })
);
```

**Expected Impact:**
- Save 10-20ms per request (non-blocking writes)
- Improved throughput under load
- Risk: Data loss on crash (acceptable for audit/stats)

---

## Phase 3: Long-Term (1-2 months, architectural consolidation)

### 3.1 Monolith-First Architecture

**Proposed Structure:**

```
backend/
├── src/
│   ├── server.ts           # Main entry point
│   ├── database/           # Prisma client, migrations
│   ├── auth/               # Auth routes + logic
│   ├── location/           # H3 geo logic
│   ├── ride/               # Trip lifecycle
│   ├── notify/             # Socket.IO server
│   ├── admin/              # Admin routes
│   ├── payment/            # Payment logic
│   └── shared/             # Utils, middleware
├── tests/
└── package.json
```

File: `backend/src/server.ts`

```typescript
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';

// Import route modules
import { authRouter } from './auth/routes.js';
import { rideRouter } from './ride/routes.js';
import { locationRouter } from './location/routes.js';
import { adminRouter } from './admin/routes.js';
import { paymentRouter } from './payment/routes.js';

// Import Socket.IO setup
import { initializeSocketIO } from './notify/socket-server.js';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' },
});

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/rider', rideRouter);
app.use('/api/driver', rideRouter);
app.use('/api/admin', adminRouter);
app.use('/api/payment', paymentRouter);
app.use('/internal/location', locationRouter);

// Socket.IO
initializeSocketIO(io);

// Shared in-memory state
export const state = {
  io,
  activeConnections: new Map<string, string>(), // userId -> socketId
};

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Eve server listening on port ${PORT}`);
});
```

**Benefits:**

1. **Zero network latency** between modules
2. **Shared in-memory state** (connections, cache)
3. **Simpler deployment** (one Docker image)
4. **Faster development** (no inter-service coordination)
5. **Still modular** (separate folders, can extract later)

**Migration Path:**

1. Create new monolith repo
2. Copy all service logic into modules
3. Replace inter-service calls with function calls
4. Run monolith in parallel with microservices
5. Route 10% → 50% → 100% traffic
6. Deprecate microservices

---

### 3.2 Split Only When Necessary

**When to Extract a Service:**

1. **Location Service** (if CPU-bound geo calculations)
   - Horizontal scaling needed
   - Different language (Rust/Go for performance)

2. **Notify Service** (if Socket.IO state is large)
   - Needs sticky sessions
   - Separate scaling profile

3. **Payment Service** (if compliance requires isolation)
   - Separate security boundary
   - Different team ownership

**Default:** Keep in monolith until you have evidence of bottleneck.

---

## Phase 4: Database Optimizations (Ongoing)

### 4.1 Read Replicas for Heavy Queries

```typescript
// Primary for writes
const prismaWrite = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL }
  }
});

// Replica for reads (admin dashboard, reports)
const prismaRead = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_READ_URL }
  }
});

// Use in admin service
export async function getDashboardStats() {
  return prismaRead.trip.aggregate({
    _count: true,
    where: { createdAt: { gte: startOfToday() } }
  });
}
```

### 4.2 Connection Pooling

File: `backend/src/database/client.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

// Use PgBouncer for connection pooling
const connectionString = `${process.env.DATABASE_URL}?pgbouncer=true&connection_limit=20`;

export const prisma = new PrismaClient({
  datasources: {
    db: { url: connectionString }
  },
  log: ['error', 'warn'],
});
```

Docker Compose:

```yaml
pgbouncer:
  image: pgbouncer/pgbouncer:latest
  environment:
    DATABASES: eve=host=postgres port=5432 dbname=eve
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 1000
    DEFAULT_POOL_SIZE: 20
  ports:
    - "6432:6432"
```

Update DATABASE_URL: `postgresql://eve:eve@pgbouncer:6432/eve`

---

## Rollout Strategy

### Week 1-2: Quick Wins
- [ ] Add OpenTelemetry tracing
- [ ] Measure baseline latency
- [ ] Implement direct notify calls (feature flag)
- [ ] A/B test Kafka vs Direct (10% traffic)

### Week 3-4: Remove Kafka
- [ ] Migrate 50% traffic to direct calls
- [ ] Monitor error rates
- [ ] Migrate 100% traffic
- [ ] Remove Kafka from docker-compose

### Week 5-6: HTTP Standardization
- [ ] Add HTTP endpoints to location service
- [ ] Migrate ride service to HTTP client
- [ ] Compare gRPC vs HTTP latency
- [ ] Decide: keep gRPC or migrate to HTTP

### Week 7-8: Service Consolidation
- [ ] Merge location logic into ride service
- [ ] Deploy consolidated service
- [ ] Deprecate standalone location service

### Week 9-12: Monolith Migration (Optional)
- [ ] Create monolith structure
- [ ] Migrate one module per week
- [ ] Run parallel for 2 weeks
- [ ] Full cutover

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| P95 Trip Creation | ~200ms | <120ms |
| P95 Offer Submit | ~150ms | <80ms |
| P95 Socket.IO Event | ~50ms | <20ms |
| Services Count | 6 | 3 or 1 |
| Failed Requests (%) | <0.1% | <0.1% |
| MTTR (minutes) | ~15 | <5 |

---

## Risk Mitigation

### Risks

1. **Data Loss**: Async writes could lose audit logs on crash
   - Mitigation: Only async non-critical data; add flush on shutdown

2. **Notify Outage**: Direct calls remove Kafka buffer
   - Mitigation: Circuit breaker with HTTP fallback

3. **Monolith Single Point of Failure**
   - Mitigation: Run 3+ instances behind load balancer

4. **Shared State in Monolith**
   - Mitigation: Use Redis for cross-instance state if needed

### Rollback Plans

- Feature flags for all changes
- Keep old code paths for 2 weeks
- Database migrations are backwards compatible
- Blue/green deployment for monolith

---

## Cost Savings

**Infrastructure:**
- Remove Kafka: -$100/month (AWS MSK) or -1 VM
- Reduce services: 6 VMs → 3 VMs = -50% compute
- Smaller Docker images: -30% storage

**Engineering:**
- Simpler debugging: -20% incident response time
- Faster onboarding: -2 weeks new dev ramp-up
- Less glue code: -1000 LOC maintenance burden

---

## Questions to Answer with Data

1. What is actual P50/P95/P99 latency? (Add tracing first!)
2. What % of latency is network vs database vs compute?
3. Do you ever have >5 concurrent requests per service?
4. What's the actual throughput (req/sec) in production?
5. How often does notify service fail (justify circuit breaker)?

**Action:** Run tracing for 1 week before making architectural decisions.

---

## Conclusion

**TL;DR:**
1. Remove Kafka → Save 30ms, reduce complexity
2. Consolidate services → Save 20ms, simplify deployment
3. In-memory caching → Save 5ms, remove Redis queries
4. Async writes → Save 15ms, improve throughput

**Total:** ~70ms latency reduction (35% improvement)

**Philosophy:** Optimize data structures first (✅ H3), then code, then consider distributed systems. You've jumped to the last step too early for your scale.
