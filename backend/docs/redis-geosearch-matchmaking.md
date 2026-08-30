# Redis GEO matchmaking

Eve matchmaking uses Redis **GEO** indexes (geohash sorted sets) so nearby-driver and nearby-trip lookups scale with the 25 km radius, not with the size of the whole fleet.

Postgres remains the source of truth for presence, approval, vehicles, and coordinates. Redis is a live spatial index.

This is not a custom geohash implementation. Redis stores each member as a geohash score (`GEOADD`) and queries it with `GEOSEARCH`.

## How it is used

Two query paths:

| Rider / request | Driver / incoming |
|---|---|
| `nearbyDrivers` | `nearbySearchingTrips` |
| Search online drivers near pickup | Search `SEARCHING` trips near the driver |

Flow:

1. Write lat/lng into Postgres (`DriverProfile` or `Trip`).
2. Dual-write the same point into Redis with `GEOADD`.
3. On match, run `GEOSEARCH … BYRADIUS <MATCH_RADIUS_KM> km ASC` with a count a bit above `MATCH_LIMIT` (5).
4. Hydrate those ids in Postgres (still `APPROVED` + `ONLINE`/`IDLE`, or still `SEARCHING`).
5. Return the closest `MATCH_LIMIT` hits using Redis distance.

If Redis is down, matching falls back to loading candidates from Postgres and filtering with Haversine (`distanceKm`). Fare / trip length still use `distanceKm` (pickup → dropoff). That is not the geo index.

### Keys

Production prefix is `geo:`. Vitest workers use `geo:test:<workerId>:` so parallel tests do not share an index.

| Key | Members | When written |
|---|---|---|
| `geo:drivers:CAR` / `geo:drivers:BIKE` | `DriverProfile.id` | Driver is `APPROVED` and `ONLINE`/`IDLE` with coordinates |
| `geo:trips:CAR` / `geo:trips:BIKE` | `Trip.id` | Trip status is `SEARCHING` |
| `geo:driver:users` | hash `userId` → profile id | Same time as driver `GEOADD` |

Drivers with both vehicle types are in both driver keys. `OFFLINE`, `ON_TRIP`, or missing coords → `ZREM`. GPS pings update Redis even when the 15s Postgres write is skipped, but only if the driver is already in the geo set.

### Query

Equivalent Redis command (CAR example):

```
GEOSEARCH geo:drivers:CAR FROMLONLAT <pickupLng> <pickupLat>
  BYRADIUS 25 km ASC COUNT 15 WITHDIST WITHCOORD
```

Longitude comes first (Redis convention). Earth is treated as a sphere, including across the antimeridian.

Code: [`services/location/src/geo.ts`](../services/location/src/geo.ts), wired from [`services/location/src/matching.ts`](../services/location/src/matching.ts).

### Dual-write and rebuild

| Event | Redis |
|---|---|
| `PATCH /api/driver/presence` | `GEOADD` or `ZREM` |
| Socket / internal GPS | `GEOADD` if already indexed |
| Rider creates a trip | `GEOADD` trip, then `nearbyDrivers` |
| Offer accept, assign, cancel | `ZREM` trip; sync driver geo for `ON_TRIP` / `ONLINE` |

On boot, the location service and compose gateway call `rebuildGeoIndexes()`: clear the geo keys, then `GEOADD` every eligible driver and `SEARCHING` trip from Postgres. That heals a Redis restart and Prisma-only seeds (for example load-test users).

Connection: `REDIS_URL` (default `redis://127.0.0.1:6379`). Compose: `redis:7` in [`docker-compose.yml.temp`](../docker-compose.yml.temp). Production (EC2/pm2) must already have Redis reachable; deploy does not install it.

## How to change the 25 km radius

The radius is **one constant**. Redis does not store 25 km on the members; it is applied at query time.

Change [`packages/shared/src/distance.ts`](../packages/shared/src/distance.ts):

```ts
export const MATCH_RADIUS_KM = 25; // e.g. 10 or 40
export const MATCH_LIMIT = 5;
```

That value is used for:

- `GEOSEARCH` `BYRADIUS` in `geo.ts`
- Haversine fallback in `matching.ts`
- Offer gate in `driver.service.ts` (`distanceToPickup > MATCH_RADIUS_KM`)

You do **not** need to rebuild Redis keys after a radius change. Restart the backend (or let `tsx watch` reload) so every process picks up the new constant.

Also update geo tests that encode “just inside / just outside” the old radius ([`tests/matchmaking-geo.test.ts`](../tests/matchmaking-geo.test.ts) uses 24 km vs 26 km for a 25 km radius) and any comments in [`tests/helpers/geo-markets.ts`](../tests/helpers/geo-markets.ts).

`MATCH_LIMIT` (how many drivers/trips to return) is independent of radius. Change it in the same file if you want a longer or shorter list; `GEOSEARCH` over-fetches `MATCH_LIMIT * 3` so stale members can be dropped after the Postgres check.
