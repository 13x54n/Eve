# Database Documentation

Comprehensive guide to Eve's database schema, migrations, and Prisma usage.

## Table of Contents

- [Overview](#overview)
- [Schema Overview](#schema-overview)
- [Core Models](#core-models)
- [Relationships](#relationships)
- [Migrations](#migrations)
- [Seeding](#seeding)
- [Prisma Client Usage](#prisma-client-usage)
- [Performance Optimization](#performance-optimization)
- [Backup and Recovery](#backup-and-recovery)

## Overview

**Database**: PostgreSQL 16  
**ORM**: Prisma 7.9+  
**Schema**: `backend/prisma/schema.prisma`  
**Migrations**: `backend/prisma/migrations/`

### Key Features

- **Type Safety**: Prisma generates TypeScript types
- **Migrations**: Version-controlled schema changes
- **Seeding**: Test data for development
- **Indexes**: Optimized query performance
- **Constraints**: Data integrity enforcement

## Schema Overview

### Entity Diagram

```
User (authentication)
 ├── RiderProfile (rider data)
 ├── DriverProfile (driver data)
 └── StaffProfile (admin data)

DriverProfile
 ├── Vehicles (car/bike)
 └── Offers (fare submissions)

Trip (ride requests)
 ├── Rider (RiderProfile)
 ├── Driver (DriverProfile)
 ├── Offers (fare offers)
 ├── TripLocations (GPS history)
 └── ChatMessages (in-trip chat)

Market (geographic areas)
 ├── Zones (pricing zones)
 └── FareConfigs (pricing rules)

Vehicle
 └── VehicleModel (make/model)
```

## Core Models

### User

Central authentication model. All users (riders, drivers, admin) have a User record.

```prisma
model User {
  id            Int           @id @default(autoincrement())
  email         String        @unique
  passwordHash  String?       // Null for Auth0-only users
  auth0Sub      String?       @unique
  phoneNumber   String?
  role          UserRole      // RIDER, DRIVER, ADMIN
  accountStatus AccountStatus // ACTIVE, SUSPENDED, PENDING, DELETED
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  
  riderProfile  RiderProfile?
  driverProfile DriverProfile?
  staffProfile  StaffProfile?
}

enum UserRole {
  RIDER
  DRIVER
  ADMIN
}

enum AccountStatus {
  ACTIVE
  SUSPENDED
  PENDING
  DELETED
}
```

**Key Points**:
- `auth0Sub` links to Auth0 identity
- `passwordHash` is null for Auth0 users
- `role` is the primary user type (RIDER or DRIVER)
- Each user can have one of each profile type

### RiderProfile

Rider-specific data.

```prisma
model RiderProfile {
  id              Int      @id @default(autoincrement())
  userId          Int      @unique
  user            User     @relation(fields: [userId], references: [id])
  phoneNumber     String?
  favoriteLocations Json?  // Saved addresses
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  trips           Trip[]   @relation("RiderTrips")
}
```

### DriverProfile

Driver-specific data including location and status.

```prisma
model DriverProfile {
  id               Int               @id @default(autoincrement())
  userId           Int               @unique
  user             User              @relation(fields: [userId], references: [id])
  phoneNumber      String?
  approvalStatus   ApprovalStatus    // PENDING, APPROVED, REJECTED
  onlineStatus     OnlineStatus      // OFFLINE, ONLINE, IDLE, ON_TRIP
  latitude         Float?
  longitude        Float?
  lastLocationUpdate DateTime?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  
  vehicles         Vehicle[]
  trips            Trip[]            @relation("DriverTrips")
  offers           Offer[]
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

enum OnlineStatus {
  OFFLINE
  ONLINE
  IDLE
  ON_TRIP
}
```

**Key Points**:
- `latitude`/`longitude` are updated every 5-15 seconds when online
- `approvalStatus` controls if driver can go online
- `onlineStatus` determines if driver receives trip requests

### Trip

Core trip/ride model.

```prisma
model Trip {
  id              Int         @id @default(autoincrement())
  riderId         Int
  rider           RiderProfile @relation("RiderTrips", fields: [riderId], references: [id])
  driverId        Int?
  driver          DriverProfile? @relation("DriverTrips", fields: [driverId], references: [id])
  
  status          TripStatus  // SEARCHING, ASSIGNED, DRIVER_ARRIVING, etc.
  vehicleType     VehicleType // CAR, BIKE
  
  pickupLat       Float
  pickupLng       Float
  pickupAddress   String?
  dropoffLat      Float
  dropoffLng      Float
  dropoffAddress  String?
  
  suggestedFare   Decimal     @db.Decimal(10, 2)
  matchedFare     Decimal?    @db.Decimal(10, 2)
  distance        Float?      // kilometers
  duration        Int?        // minutes
  
  scheduledFor    DateTime?   // Future trips
  createdAt       DateTime    @default(now())
  startedAt       DateTime?
  completedAt     DateTime?
  cancelledAt     DateTime?
  cancelReason    String?
  
  offers          Offer[]
  locations       TripLocation[]
  chatMessages    ChatMessage[]
  
  @@index([riderId, status])
  @@index([driverId, status])
  @@index([status])
  @@index([createdAt])
}

enum TripStatus {
  SEARCHING
  ASSIGNED
  DRIVER_ARRIVING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum VehicleType {
  CAR
  BIKE
}
```

**Indexes**:
- `(riderId, status)` - Find rider's active trips
- `(driverId, status)` - Find driver's active trips
- `status` - Query all SEARCHING trips
- `createdAt` - Recent trips

### Offer

Driver fare offers for trips.

```prisma
model Offer {
  id           Int            @id @default(autoincrement())
  tripId       Int
  trip         Trip           @relation(fields: [tripId], references: [id])
  driverId     Int
  driver       DriverProfile  @relation(fields: [driverId], references: [id])
  
  fare         Decimal        @db.Decimal(10, 2)
  message      String?
  status       OfferStatus    // PENDING, ACCEPTED, REJECTED
  
  createdAt    DateTime       @default(now())
  respondedAt  DateTime?
  
  @@unique([tripId, driverId])
  @@index([tripId, createdAt])
  @@index([driverId, createdAt])
}

enum OfferStatus {
  PENDING
  ACCEPTED
  REJECTED
}
```

**Constraints**:
- One offer per driver per trip (unique constraint)

### Vehicle

Driver vehicles.

```prisma
model Vehicle {
  id              Int           @id @default(autoincrement())
  driverProfileId Int
  driverProfile   DriverProfile @relation(fields: [driverProfileId], references: [id])
  vehicleModelId  Int
  vehicleModel    VehicleModel  @relation(fields: [vehicleModelId], references: [id])
  
  type            VehicleType   // CAR, BIKE
  year            Int
  color           String
  licensePlate    String        @unique
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model VehicleModel {
  id        Int       @id @default(autoincrement())
  make      String    // Toyota, Honda, etc.
  model     String    // Corolla, Civic, etc.
  
  vehicles  Vehicle[]
  
  @@unique([make, model])
}
```

### FareConfig

Pricing configuration per market and vehicle type.

```prisma
model FareConfig {
  id              Int           @id @default(autoincrement())
  marketId        Int
  market          Market        @relation(fields: [marketId], references: [id])
  vehicleType     VehicleType
  
  baseFare        Decimal       @db.Decimal(10, 2)
  perKm           Decimal       @db.Decimal(10, 2)
  perMinute       Decimal       @db.Decimal(10, 2)
  minFare         Decimal       @db.Decimal(10, 2)
  bookingFee      Decimal       @db.Decimal(10, 2)
  surgeMultiplier Decimal       @default(1.0) @db.Decimal(5, 2)
  
  status          ConfigStatus  // DRAFT, APPROVED, ACTIVE, ROLLED_BACK
  version         Int           @default(1)
  
  effectiveFrom   DateTime?
  effectiveTo     DateTime?
  createdAt       DateTime      @default(now())
  approvedAt      DateTime?
  approvedBy      Int?
  
  @@unique([marketId, vehicleType, version])
  @@index([marketId, vehicleType, status])
}

enum ConfigStatus {
  DRAFT
  APPROVED
  ACTIVE
  ROLLED_BACK
}
```

## Relationships

### One-to-One

- `User` ↔ `RiderProfile`
- `User` ↔ `DriverProfile`
- `User` ↔ `StaffProfile`

### One-to-Many

- `RiderProfile` → `Trip[]` (trips created)
- `DriverProfile` → `Trip[]` (trips completed)
- `DriverProfile` → `Offer[]` (offers submitted)
- `DriverProfile` → `Vehicle[]` (vehicles owned)
- `Trip` → `Offer[]` (offers received)
- `Trip` → `TripLocation[]` (GPS history)
- `Trip` → `ChatMessage[]` (chat history)
- `Market` → `Zone[]` (pricing zones)
- `Market` → `FareConfig[]` (pricing configs)

## Migrations

### Creating a Migration

```bash
cd backend

# 1. Edit schema.prisma
# 2. Create migration
npm run db:migrate

# Migration prompts for name
# Example: "add_driver_ratings"
```

This creates:
- SQL migration file in `prisma/migrations/`
- Updates database schema
- Regenerates Prisma Client

### Migration Files

```
prisma/migrations/
  20240901_init/
    migration.sql
  20240902_add_vehicles/
    migration.sql
  20240903_add_chat/
    migration.sql
```

### Applying Migrations

**Development**:
```bash
npm run db:migrate
```

**Production**:
```bash
npx prisma migrate deploy
```

### Rolling Back

Prisma doesn't support automatic rollback. To undo:

```bash
# 1. Manually write down migration
# 2. Apply down migration
npx prisma db execute --file rollback.sql

# 3. Mark migration as resolved
npx prisma migrate resolve --rolled-back <migration_name>
```

### Migration Best Practices

- **Test** migrations on development database first
- **Backup** production before applying
- **Avoid** breaking changes (add columns as optional first)
- **Data migrations**: Write separate SQL scripts
- **Review** generated SQL before applying

## Seeding

Seed script: `backend/prisma/seed.ts`

### Running Seed

```bash
cd backend
npm run db:seed
```

### What Gets Seeded

1. **Admin Users**:
   - owner@eve.local (OWNER)
   - ops@eve.local (OPERATIONS)
   - finance@eve.local (FINANCE)
   - support@eve.local (SUPPORT)
   - safety@eve.local (SAFETY)
   - Password: `Admin123!`

2. **Test Riders**:
   - amina@example.com
   - luis@example.com
   - priya@example.com
   - noah@example.com

3. **Test Drivers**:
   - jordan.driver@example.com
   - elena.driver@example.com
   - chris.driver@example.com

4. **Vehicle Models**:
   - Toyota Corolla, Honda Civic, etc.

5. **Markets and Zones**:
   - Toronto market
   - Downtown, Midtown zones

6. **Fare Configurations**:
   - CAR and BIKE pricing

### Custom Seed

Edit `backend/prisma/seed.ts`:

```typescript
async function main() {
  // Create custom data
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      role: 'RIDER',
      riderProfile: {
        create: {}
      }
    }
  });
}
```

## Prisma Client Usage

### Basic Queries

```typescript
import { prisma } from '@eve/db';

// Find unique
const user = await prisma.user.findUnique({
  where: { id: 1 }
});

// Find many
const riders = await prisma.user.findMany({
  where: { role: 'RIDER' }
});

// Create
const trip = await prisma.trip.create({
  data: {
    riderId: 1,
    vehicleType: 'CAR',
    pickupLat: 43.65,
    pickupLng: -79.38,
    dropoffLat: 43.66,
    dropoffLng: -79.39,
    suggestedFare: 15.50,
    status: 'SEARCHING'
  }
});

// Update
await prisma.trip.update({
  where: { id: 1 },
  data: { status: 'ASSIGNED', driverId: 2 }
});

// Delete
await prisma.trip.delete({
  where: { id: 1 }
});
```

### Relations

```typescript
// Include related data
const trip = await prisma.trip.findUnique({
  where: { id: 1 },
  include: {
    rider: { include: { user: true } },
    driver: { include: { user: true } },
    offers: true
  }
});

// Nested create
const user = await prisma.user.create({
  data: {
    email: 'rider@example.com',
    role: 'RIDER',
    riderProfile: {
      create: {
        phoneNumber: '+1234567890'
      }
    }
  },
  include: { riderProfile: true }
});
```

### Filtering

```typescript
// Where conditions
const trips = await prisma.trip.findMany({
  where: {
    status: 'SEARCHING',
    vehicleType: 'CAR',
    createdAt: {
      gte: new Date('2026-01-01')
    }
  }
});

// OR conditions
const users = await prisma.user.findMany({
  where: {
    OR: [
      { role: 'RIDER' },
      { role: 'DRIVER' }
    ]
  }
});
```

### Transactions

```typescript
// Accept offer (atomic)
const result = await prisma.$transaction(async (tx) => {
  // Update trip
  const trip = await tx.trip.update({
    where: { id: tripId },
    data: {
      status: 'ASSIGNED',
      driverId: offer.driverId,
      matchedFare: offer.fare
    }
  });
  
  // Update offer
  await tx.offer.update({
    where: { id: offerId },
    data: { status: 'ACCEPTED' }
  });
  
  // Reject other offers
  await tx.offer.updateMany({
    where: {
      tripId,
      id: { not: offerId }
    },
    data: { status: 'REJECTED' }
  });
  
  return trip;
});
```

### Raw Queries

```typescript
// Raw SQL (when Prisma query builder is insufficient)
const result = await prisma.$queryRaw`
  SELECT * FROM "Trip"
  WHERE ST_DWithin(
    ST_Point(${lng}, ${lat})::geography,
    ST_Point("pickupLng", "pickupLat")::geography,
    ${radiusMeters}
  )
`;
```

## Performance Optimization

### Indexes

Critical indexes are defined in schema:

```prisma
model Trip {
  // ... fields
  
  @@index([riderId, status])      // Rider's active trips
  @@index([driverId, status])     // Driver's active trips
  @@index([status])               // All searching trips
  @@index([createdAt])            // Recent trips
}
```

### Query Optimization

**Bad** (N+1 queries):
```typescript
const trips = await prisma.trip.findMany();
for (const trip of trips) {
  const rider = await prisma.riderProfile.findUnique({
    where: { id: trip.riderId }
  });
}
```

**Good** (single query):
```typescript
const trips = await prisma.trip.findMany({
  include: { rider: true }
});
```

### Connection Pooling

Configure in `DATABASE_URL`:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20"
```

Or use PgBouncer for production.

### Query Logging

Enable for debugging:

```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

Or via environment:
```bash
DATABASE_URL="postgresql://...?log=query"
```

## Backup and Recovery

### Manual Backup

```bash
# Backup database
docker compose exec postgres pg_dump -U eve eve > backup.sql

# Compress
gzip backup.sql
```

### Restore

```bash
# Restore from backup
docker compose exec -T postgres psql -U eve eve < backup.sql
```

### Automated Backups

See [DEPLOYMENT.md](../../DEPLOYMENT.md) for production backup strategies.

## Related Documentation

- [Services Guide](services.md) - How services use the database
- [Architecture](../../ARCHITECTURE.md) - Overall system design
- [Prisma Documentation](https://www.prisma.io/docs)

---

**Last Updated**: 2026-09-01
