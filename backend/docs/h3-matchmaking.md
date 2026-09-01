# H3 matchmaking

Eve matchmaking indexes drivers and searching trips in **Uber H3** cells stored as Redis sets. Nearby lookups scale with the cells that cover `MATCH_RADIUS_KM` (15 km), not with the size of the whole fleet.

Postgres remains the source of truth for presence, approval, vehicles, and coordinates. Redis is a live spatial index.

This is not Redis GEO (geohash). Each location is converted with `latLngToCell` (resolution 8). Members live in a SET per cell. Queries use `gridDisk` then Haversine to keep only points inside the radius.

## How it is used

Two query paths:

| Rider / request | Driver / incoming |
|---|---|
| `nearbyDrivers` | `nearbySearchingTrips` |
| Search online drivers near pickup | Search `SEARCHING` trips near the driver |

Flow:

1. Write lat/lng into Postgres (`DriverProfile` or `Trip`).
2. Dual-write into Redis: H3 cell SET + position hash.
3. On match, `gridDisk` around the query point, `SUNION` those cell keys, then Haversine-filter to `MATCH_RADIUS_KM` and keep a count a bit above `MATCH_LIMIT` (5).
4. Hydrate those ids in Postgres (still `APPROVED` + `ONLINE`/`IDLE`, or still `SEARCHING`) and rank with Postgres coordinates.
5. Return the closest `MATCH_LIMIT` hits.

If Redis is down, matching falls back to loading candidates from Postgres and filtering with Haversine (`distanceKm`). Fare / trip length still use `distanceKm` (pickup → dropoff). That is not the geo index.

### Keys

Production prefix is `h3:`. Vitest workers use `h3:test:<workerId>:` so parallel tests do not share an index.

| Key | Members | When written |
|---|---|---|
| `h3:drivers:CAR:<cell>` / `h3:drivers:BIKE:<cell>` | SET of `DriverProfile.id` | Driver is `APPROVED` and `ONLINE`/`IDLE` with coordinates |
| `h3:trips:CAR:<cell>` / `h3:trips:BIKE:<cell>` | SET of `Trip.id` | Trip status is `SEARCHING` |
| `h3:pos:drivers` / `h3:pos:trips` | HASH `id` → `lat,lng` | Same time as cell SET write |
| `h3:driver:cells` / `h3:trip:cells` | HASH `id` → cell | So GPS can `SREM` the old cell and `SADD` the new one |
| `h3:driver:users` | HASH `userId` → profile id | Same time as driver index write |

Drivers with both vehicle types are in both vehicle indexes. `OFFLINE`, `ON_TRIP`, or missing coords → remove from cell sets. GPS pings update the position hash even when the 15s Postgres write is skipped, but only if the driver is already indexed. If the H3 cell is unchanged, only the position hash is updated.

### Query

Resolution **8** (~0.46 km hex edge). `MATCH_DISK_K` is `ceil(MATCH_RADIUS_KM / edge) + 1` so the disk covers the 15 km circle even where H3 hops stretch near icosahedron edges. Hits outside the circle are dropped with Haversine.

Code: [`services/location/src/geo.ts`](../services/location/src/geo.ts) and [`services/location/src/h3.ts`](../services/location/src/h3.ts), wired from [`services/location/src/matching.ts`](../services/location/src/matching.ts).

### Dual-write and rebuild

| Event | Redis |
|---|---|
| `PATCH /api/driver/presence` | `SADD` / `SREM` cell sets |
| Socket / internal GPS | Update position (and cell if it changed) if already indexed |
| Rider creates a trip | Index trip cells, then `nearbyDrivers` |
| Offer accept, assign, cancel | Remove trip; sync driver geo for `ON_TRIP` / `ONLINE` |

On boot, the location service and compose gateway call `rebuildGeoIndexes()`: `SCAN`/`UNLINK` the H3 (and leftover GEO) namespace, then re-index every eligible driver and `SEARCHING` trip from Postgres. That heals a Redis restart and Prisma-only seeds (for example load-test users).

Connection: `REDIS_URL` (default `redis://127.0.0.1:6379`). Compose: `redis:7` in [`docker-compose.yml.temp`](../docker-compose.yml.temp). Production (EC2/pm2) must already have Redis reachable; deploy does not install it.

## How to change the 15 km radius

The radius is **one constant**. H3 cells do not store 15 km on the members; it is applied at query time (`gridDisk` size + Haversine filter).

Change [`packages/shared/src/distance.ts`](../packages/shared/src/distance.ts):

```ts
export const MATCH_RADIUS_KM = 15; // e.g. 10 or 40
export const MATCH_LIMIT = 5;
```

That value is used for:

- H3 `gridDisk` size in `h3.ts` / cell `SUNION` in `geo.ts`
- Haversine filter in `geo.ts` and fallback in `matching.ts`
- Offer gate in `driver.service.ts` (`distanceToPickup > MATCH_RADIUS_KM`)

You do **not** need to rebuild Redis keys after a radius change (cells stay the same). Restart the backend (or let `tsx watch` reload) so every process picks up the new constant and a new `MATCH_DISK_K`.

Also update geo tests that encode “just inside / just outside” the radius ([`tests/matchmaking-geo.test.ts`](../tests/matchmaking-geo.test.ts)) and any comments in [`tests/helpers/geo-markets.ts`](../tests/helpers/geo-markets.ts).

`MATCH_LIMIT` (how many drivers/trips to return) is independent of radius. Change it in the same file if you want a longer or shorter list; the H3 path over-fetches `MATCH_LIMIT * 3` so stale members can be dropped after the Postgres check.
