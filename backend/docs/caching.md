# Redis Caching Implementation

## Overview
This document tracks the implementation of the Redis caching strategy for the Eve backend.

## Phase 1: Foundation & Fare Configuration Cache ✅

### Implemented Components

#### 1. Shared Cache Service
**File:** `backend/packages/shared/src/cache.ts`

Created a comprehensive `CacheService` class with the following methods:
- `get(key)` / `set(key, value, ttl)` - Basic string operations
- `hGetAll(key)` / `hSet(key, field, value)` / `hSetAll(key, fields)` - Hash operations
- `del(...keys)` - Delete keys
- `expire(key, seconds)` - Set TTL
- `exists(key)` - Check key existence
- `increment(key)` / `decrement(key)` - Counter operations
- `zAdd(key, score, member)` / `zRevRange(key, start, stop)` - Sorted set operations
- `invalidatePattern(pattern)` - Pattern-based invalidation using SCAN
- `getMetrics()` - Cache hit/miss tracking

**Features:**
- Singleton instance exported as `cache`
- Built-in metrics tracking (hits, misses, errors, hit rate)
- Graceful fallback on Redis unavailability
- Error logging without crashing
- Generic `withCache<T>()` wrapper for cache-aside pattern

#### 2. Fare Configuration Caching
**File:** `backend/packages/db/src/fare.ts`

**Cache Keys:**
- `fare:config:{city}:{vehicleType}` → Hash (all fare config fields)
- `fare:min:{city}:{vehicleType}` → String (minimum fare quick lookup)

**TTL:** 24 hours (86400 seconds)

**Cached Data:**
- baseFare, perKm, perMinute, minFare, bookingFee, surgeMultiplier

**Cache Strategy:**
- Cache-aside pattern: check cache first, query DB on miss, populate cache
- Separate min fare cache for frequent quick lookups
- Fallback to default values if config not found

#### 3. Cache Invalidation
**File:** `backend/services/admin/src/admin.service.ts`

Added `invalidateFareCache()` calls in:
- `savePricing()` - After creating new fare config
- `transitionPricing()` - After approving/rolling back fare config

Invalidates both full config and min fare caches.

#### 4. Package Exports
**Files:**
- `backend/packages/shared/src/index.ts` - Export cache, CacheService, withCache
- `backend/packages/db/src/index.ts` - Export invalidateFareCache

### Performance Impact (Expected)

**Fare Calculation:**
- Before: 50ms (database query + processing)
- After: 5ms (cache hit)
- Reduction: 90%

**Query Volume:**
- Estimated 100-1000+ fare config queries/hour eliminated from PostgreSQL
- Cache hit rate expected: 95%+

### Testing Recommendations

1. **Unit Tests:**
   ```typescript
   // Mock Redis for cache hit/miss scenarios
   test('getCachedFareConfig - cache hit')
   test('getCachedFareConfig - cache miss')
   test('invalidateFareCache - clears both caches')
   ```

2. **Integration Tests:**
   ```typescript
   // Real Redis connection
   test('fare config cached after first query')
   test('cache invalidated on fare config update')
   test('graceful fallback when Redis unavailable')
   ```

3. **Load Tests:**
   ```bash
   # Compare response times before/after
   k6 run fare-estimate-load-test.js
   ```

### Monitoring

Track these metrics in production:
- Cache hit rate for `fare:config:*` and `fare:min:*` keys
- Redis memory usage for fare caches
- API response time for trip estimates
- Fallback rate (Redis unavailability)

Use `cache.getMetrics()` to get real-time metrics:
```typescript
{
  hits: 1250,
  misses: 50,
  errors: 0,
  hitRate: 0.96
}
```

## Phase 2: Core Features (Planned)

### 1. Driver Profile Multi-Level Cache
**Files to modify:**
- `backend/packages/db/src/driver-profile.ts`

**Cache structure:**
- `driver:profile:{userId}` → JSON (5 min TTL)
- `driver:stats:today:{driverId}` → Hash (2 min TTL)
- `driver:presence:{userId}` → String (30 sec TTL)

### 2. Active Trip Cache
**Files to modify:**
- `backend/services/ride/src/rider.service.ts`
- `backend/services/ride/src/driver.service.ts`

**Cache structure:**
- `trip:active:{userId}` → String (tripId, 6 hour TTL)
- `trip:detail:{tripId}` → JSON (1 hour TTL, 24h for completed)

### 3. Session Management
**Files to modify:**
- `backend/services/auth/src/auth.service.ts`
- `backend/packages/http/src/auth-middleware.ts`

**Cache structure:**
- `auth:blacklist:{tokenId}` → "1" (TTL = remaining token lifetime)
- `auth:session:{userId}` → Set (active sessions)
- `ratelimit:{userId}:{endpoint}:{window}` → String (count)

## Phase 3: Advanced Features (Planned)

### 1. Admin Dashboard Aggregates
- Real-time counters
- Today's statistics
- Dashboard response caching

### 2. Trip History Sorted Sets
- Pagination optimization
- Date range queries

### 3. Background Refresh Jobs
- Cache warming on startup
- Periodic dashboard refresh

## Configuration

### Environment Variables
```bash
# Redis connection (already configured)
REDIS_URL=redis://localhost:6379

# Optional: Redis cluster/sentinel for HA
# REDIS_SENTINEL_HOSTS=host1:26379,host2:26379
# REDIS_SENTINEL_NAME=mymaster
```

### Redis Memory Management
Recommend setting maxmemory policy in redis.conf:
```
maxmemory 1gb
maxmemory-policy allkeys-lru
```

## Rollback Plan

If issues arise:
1. Redis caching gracefully degrades - system works without Redis
2. To disable specific caches, set short TTL or clear pattern:
   ```typescript
   await cache.invalidatePattern('fare:*');
   ```
3. Monitor error metrics in `cache.getMetrics()`

## Next Steps

1. ✅ Phase 1 complete - Fare configuration caching implemented
2. ⏳ Add unit and integration tests for fare caching
3. ⏳ Monitor cache metrics in staging environment
4. ⏳ Begin Phase 2 implementation (driver profiles & active trips)
5. ⏳ Implement remaining priorities based on performance data

## Resources

- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Cache-Aside Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside)
- [Redis Node Client Docs](https://github.com/redis/node-redis)
