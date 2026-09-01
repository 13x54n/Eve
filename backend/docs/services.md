# Backend Services Guide

Detailed documentation for Eve's microservices architecture.

## Table of Contents

- [Overview](#overview)
- [Gateway Service](#gateway-service)
- [Auth Service](#auth-service)
- [Location Service](#location-service)
- [Ride Service](#ride-service)
- [Notify Service](#notify-service)
- [Shared Packages](#shared-packages)
- [Service Communication](#service-communication)

## Overview

Eve's backend consists of 5 main components:
- **Gateway**: API entry point and routing
- **Auth**: Authentication and user management
- **Location**: GPS tracking and geospatial matching
- **Ride**: Trip lifecycle and offer management
- **Notify**: Real-time events via WebSocket

## Gateway Service

**Port**: 4000  
**Package**: `@eve/gateway`  
**Location**: `backend/gateway/`

### Responsibilities

- Route HTTP requests to appropriate services
- Serve admin API endpoints (not delegated to services)
- CORS configuration and enforcement
- Rate limiting
- Health checks aggregation

### Routing Rules

| Path | Target | Method |
|------|--------|--------|
| `/api/health` | Gateway | GET |
| `/api/auth/*` | Auth service | ALL |
| `/api/driver/auth0` | Auth service | POST |
| `/api/driver/presence` | Location service | POST |
| `/api/driver/*` | Ride service | ALL |
| `/api/rider/*` | Ride service | ALL |
| `/api/public/*` | Ride service | GET |
| `/api/admin/*` | Gateway (local) | ALL |
| `/socket.io/*` | Notify service | WebSocket |

### Configuration

**Environment Variables**:
- `PORT` - Listen port (default: 4000)
- `GATEWAY_MODE` - `compose` or `proxy`
- `AUTH_URL`, `LOCATION_URL`, `RIDE_URL`, `NOTIFY_URL` - Service URLs (proxy mode)

### Modes

**Compose Mode** (default):
- All services in one process
- Faster startup
- Lower latency
- Ideal for development

**Proxy Mode**:
- Separate processes
- Independent scaling
- Production deployment
- HTTP/gRPC inter-service communication

### Admin API

Gateway serves admin endpoints directly:

- `POST /api/admin/login` - Admin login
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/riders` - List riders
- `GET /api/admin/drivers` - List drivers
- `PATCH /api/admin/drivers/:id/approval` - Approve driver
- `GET /api/admin/trips` - List trips
- `POST /api/admin/pricing` - Create fare config

**See**: `backend/gateway/src/admin.service.ts`

## Auth Service

**Port**: 4001  
**Package**: `@eve/auth`  
**Location**: `backend/services/auth/`

### Responsibilities

- Auth0 ID token verification
- Eve JWT issuance
- Admin email/password authentication
- User profile management
- Session validation

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/auth0` | POST | Rider Auth0 exchange |
| `/api/auth/driver/auth0` | POST | Driver Auth0 exchange |
| `/api/auth/me` | GET | Current user profile |
| `/api/auth/me` | PATCH | Update profile |
| `/api/auth/admin/login` | POST | Admin login |
| `/health` | GET | Service health |

### Auth0 Integration

**Flow**:
1. Mobile app opens Auth0 Universal Login
2. User authenticates with Auth0
3. App receives Auth0 ID token
4. App exchanges ID token for Eve JWT
5. Eve JWT used for all API calls

**Verification**:
- Fetch JWKS from Auth0
- Verify signature, issuer, audience
- Extract claims (email, sub)

**User Resolution**:
- Match by `auth0Sub` (preferred)
- Fallback: match by verified email
- Create new user if not found
- Create rider/driver profile as needed

**Code**: `backend/services/auth/src/server.ts`

### JWT Issuance

**Claims**:
```json
{
  "userId": 123,
  "role": "RIDER",
  "session": "rider",
  "iat": 1234567890,
  "exp": 1237159890
}
```

**Expiry**: 30 days (configurable)

**Secrets**:
- `JWT_ACCESS_SECRET` - Required
- `JWT_REFRESH_SECRET` - Optional (future)

### Admin Authentication

Email/password authentication for staff:
- Passwords hashed with bcrypt
- Session-based tokens
- Role-based access control

**Seeded accounts** (dev only):
- owner@eve.local (OWNER)
- ops@eve.local (OPERATIONS)
- finance@eve.local (FINANCE)
- support@eve.local (SUPPORT)
- safety@eve.local (SAFETY)

**Password**: `Admin123!`

## Location Service

**Port**: 4002  
**Package**: `@eve/location`  
**Location**: `backend/services/location/`

### Responsibilities

- Track driver GPS positions
- Maintain H3 geospatial index in Redis
- Find nearby drivers for trips
- Find nearby trips for drivers
- Calculate distances
- Manage driver presence (online/offline)

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/driver/presence` | POST | Update driver location/status |
| `POST /internal/nearby-drivers` | POST | Find drivers near pickup |
| `POST /internal/nearby-trips` | POST | Find trips near driver |
| `POST /internal/distance` | POST | Calculate distance |
| `POST /internal/index-trip` | POST | Add trip to geo index |
| `DELETE /internal/remove-trip/:id` | DELETE | Remove trip from index |
| `GET /health` | GET | Service health |

### H3 Geospatial Indexing

**Resolution**: 8 (~0.46km hexagon edge)  
**Radius**: 15km (configurable via `MATCH_RADIUS_KM`)  
**Storage**: Redis SETs

**Keys**:
```
h3:drivers:CAR:<cell>      SET of driver IDs
h3:drivers:BIKE:<cell>     SET of driver IDs
h3:trips:CAR:<cell>        SET of trip IDs
h3:trips:BIKE:<cell>       SET of trip IDs
h3:pos:drivers             HASH driver_id → "lat,lng"
h3:pos:trips               HASH trip_id → "lat,lng"
h3:driver:cells            HASH driver_id → cell
h3:trip:cells              HASH trip_id → cell
```

**Query Algorithm**:
1. Convert lat/lng to H3 cell
2. Calculate `gridDisk` (surrounding cells within radius)
3. `SUNION` all cell SETs
4. Haversine filter to exact radius
5. Validate in PostgreSQL
6. Sort by distance
7. Return top N results

**Performance**: 3-10ms for 10,000 active drivers

**See**: [h3-matchmaking.md](h3-matchmaking.md)

### GPS Updates

**Frequency**: Every 5 seconds from driver app

**Throttling**:
- Redis updated every time (real-time)
- PostgreSQL updated every 15 seconds (reduce writes)
- Only update H3 cell if changed

**Code**: `backend/services/location/src/matching.ts`

### Fallback Mode

If Redis is unavailable:
- Fall back to PostgreSQL queries
- Filter with Haversine distance
- Slower but functional

## Ride Service

**Port**: 4003  
**Package**: `@eve/ride`  
**Location**: `backend/services/ride/`

### Responsibilities

- Trip lifecycle management
- Offer submission and acceptance
- Fare calculation
- Driver-trip assignment
- Trip state transitions
- Trip history

### Key Endpoints

**Rider**:
- `POST /api/rider/trips` - Create trip request
- `GET /api/rider/trips` - List rider's trips
- `GET /api/rider/trips/:id` - Get trip details
- `POST /api/rider/trips/:id/accept-offer` - Accept offer
- `POST /api/rider/trips/:id/cancel` - Cancel trip

**Driver**:
- `GET /api/driver/trips/incoming` - Available trips nearby
- `POST /api/driver/offers` - Submit fare offer
- `GET /api/driver/trips` - List driver's trips
- `GET /api/driver/trips/:id` - Get trip details
- `PATCH /api/driver/trips/:id` - Update trip status
- `POST /api/driver/trips/:id/cancel` - Cancel trip

**Public**:
- `GET /api/public/trips/:trackingCode` - Track trip (courier mode)

### Trip States

```
SEARCHING → ASSIGNED → DRIVER_ARRIVING → IN_PROGRESS → COMPLETED
     ↓          ↓              ↓
CANCELLED  CANCELLED      CANCELLED
```

**State Transitions**:
- `SEARCHING`: Rider creates trip, drivers can submit offers
- `ASSIGNED`: Rider accepts offer, driver assigned
- `DRIVER_ARRIVING`: Driver confirmed, heading to pickup
- `IN_PROGRESS`: Driver started trip (picked up rider)
- `COMPLETED`: Driver completed trip (dropped off rider)
- `CANCELLED`: Any party cancels trip

### Fare Calculation

**Formula**:
```
fare = (baseFare + (distance * perKm) + (duration * perMinute)) * surgeMultiplier + bookingFee
fare = max(fare, minFare)
```

**Fare Config**:
- Stored in PostgreSQL (`FareConfig` table)
- Cached in Redis (24-hour TTL)
- Per city and vehicle type
- Version-controlled (approved/draft/rolled-back)

**Code**: `backend/packages/db/src/fare.ts`

### Matching Logic

**When rider creates trip**:
1. Insert trip in database (`status = SEARCHING`)
2. Index trip in H3 Redis (location service)
3. Find nearby online drivers (location service)
4. Emit `trip-request:new` to nearby drivers (notify service)
5. Return trip to rider

**When driver submits offer**:
1. Validate driver is within radius
2. Insert offer in database
3. Emit `offer:new` to rider (notify service)

**When rider accepts offer**:
1. Update trip (`status = ASSIGNED`, assign driver)
2. Remove trip from geo index
3. Update driver status (`ON_TRIP`)
4. Emit `trip:assigned` to both parties
5. Create chat room

**Code**: `backend/services/ride/src/dispatch.ts`

### Trip Chat

Real-time messaging between rider and driver:
- Socket.IO room: `trip:{tripId}`
- Messages stored in `ChatMessage` table
- Events: `chat:message`, `chat:typing`

## Notify Service

**Port**: 4004  
**Package**: `@eve/notify`  
**Location**: `backend/services/notify/`

### Responsibilities

- WebSocket connection management
- Real-time event broadcasting
- Room management (trips, users, admin)
- Push notifications (future)

### Architecture

**Socket.IO** over WebSocket:
- Automatic reconnection
- Room-based broadcasting
- Event-based messaging
- Fallback to long polling

### Rooms

| Room | Members | Purpose |
|------|---------|---------|
| `trip:{tripId}` | Rider, driver | Trip lifecycle events |
| `user:{userId}` | Single user | User-specific notifications |
| `admin` | All admin staff | Admin dashboard updates |

### Events

**Trip Events**:
- `trip:created`
- `trip:assigned`
- `trip:driver-arriving`
- `trip:in-progress`
- `trip:completed`
- `trip:cancelled`
- `trip:updated`

**Offer Events**:
- `offer:new` - New offer for rider
- `offer:accepted` - Offer accepted

**Location Events**:
- `location:updated` - Real-time driver location

**Trip Request Events**:
- `trip-request:new` - New trip for nearby drivers

**Chat Events**:
- `chat:message`
- `chat:typing`

### Authentication

WebSocket connections authenticated via JWT:
- Pass token in handshake query: `?token=<jwt>`
- Token validated on connection
- User ID extracted from token
- Auto-join user's room

### Internal API

**Emit endpoint** (HTTP):
- `POST /internal/emit`
- Used by other services to emit events
- Requires `X-Internal-Secret` header

**gRPC** (optional):
- `EmitTripEvent`
- `EmitUserEvent`
- `EmitAdminEvent`

**Code**: `backend/services/notify/src/realtime.ts`

## Shared Packages

### @eve/db

**Prisma client** and database utilities:
- `prisma` - Prisma client instance
- `PrismaClient` - Type
- `connectDatabase()` - Connect to PostgreSQL
- Fare calculation helpers
- Driver profile helpers

**Location**: `backend/packages/db/`

### @eve/http

**Express** app foundation:
- `createApp()` - Create Express app
- `requireAuth` - Auth middleware
- `requireRole()` - Role check middleware
- `validate()` - Zod validation middleware
- CORS configuration
- Rate limiting

**Location**: `backend/packages/http/`

### @eve/shared

**Shared utilities**:
- JWT encoding/decoding
- Password hashing
- Permission checking
- Distance calculations (Haversine)
- Cache service (Redis)
- Constants (match radius, limits, etc.)

**Location**: `backend/packages/shared/`

### @eve/grpc

**gRPC** client and server utilities:
- `createGrpcClient()` - Create gRPC client
- `GrpcServer` - Server wrapper
- Protocol buffer definitions

**Location**: `backend/packages/grpc/`

## Service Communication

### HTTP (Default)

**Pattern**:
```typescript
const response = await fetch(`${LOCATION_URL}/internal/nearby-drivers`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Secret': INTERNAL_SERVICE_SECRET
  },
  body: JSON.stringify(data)
});
```

**Security**: `X-Internal-Secret` header required

### gRPC (Optional)

**Enable**: `GRPC_ENABLED=true`

**Performance**: 3-10x faster than HTTP

**Pattern**:
```typescript
const drivers = await nearbyDriversGrpc({
  pickupLat: 43.65,
  pickupLng: -79.38,
  vehicleType: 'CAR'
});
```

**See**: [grpc.md](grpc.md)

### Hybrid Approach

Services use automatic fallback:
1. Try gRPC (if enabled)
2. Fall back to HTTP
3. Fall back to local function (compose mode)

## Configuration

### Environment Variables

Each service can be configured via environment variables. See [ENVIRONMENT_VARIABLES.md](../../ENVIRONMENT_VARIABLES.md).

**Common**:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level

**Service-specific**:
- `AUTH_PORT`, `LOCATION_PORT`, `RIDE_PORT`, `NOTIFY_PORT`
- `AUTH_URL`, `LOCATION_URL`, `RIDE_URL`, `NOTIFY_URL`
- `GRPC_ENABLED`, `GRPC_LOGGING`
- `MATCH_RADIUS_KM`

## Monitoring

### Health Checks

All services expose `/health`:

```bash
curl http://localhost:4000/api/health  # Gateway
curl http://localhost:4001/health      # Auth
curl http://localhost:4002/health      # Location
curl http://localhost:4003/health      # Ride
curl http://localhost:4004/health      # Notify
```

**Response**:
```json
{
  "status": "ok",
  "service": "location",
  "timestamp": "2026-09-01T10:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 123456789,
    "heapTotal": 100000000,
    "heapUsed": 75000000
  }
}
```

### Logging

Use structured logging:

```typescript
import { logger } from '@eve/shared';

logger.info('Trip created', { tripId, riderId });
logger.warn('High offer count', { tripId, count });
logger.error('Database error', { error });
```

## Related Documentation

- [Gateway Configuration](gateway.md)
- [Authentication Flow](auth.md)
- [H3 Geospatial Matching](h3-matchmaking.md)
- [gRPC Implementation](grpc.md)
- [Redis Caching](caching.md)
- [Docker Setup](docker.md)

---

**Last Updated**: 2026-09-01
