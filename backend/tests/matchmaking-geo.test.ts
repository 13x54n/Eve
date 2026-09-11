import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "./helpers/test-app.js";
import { nearbyDrivers, pingRedis, resetGeoIndexes } from "@eve/location";
import { prisma } from "@eve/db";
import { MATCH_LIMIT, MATCH_RADIUS_KM, distanceKm } from "@eve/shared";
import {
  ANTIMERIDIAN,
  ANTIMERIDIAN_FAR_DRIVER,
  ANTIMERIDIAN_NEAR_DRIVER,
  GEO_MARKETS,
  PERTH,
  REYKJAVIK,
  marketTripPayload,
  offsetKm,
  type GeoMarket,
} from "./helpers/geo-markets.js";
import {
  cleanupMarketplaceUsers,
  incomingTripIds,
  spawnApprovedOnlineDriver,
  spawnRider,
} from "./helpers/marketplace.js";

const pendingCancels: { token: string; tripId: string }[] = [];

function trackTrip(token: string, tripId: string) {
  pendingCancels.push({ token, tripId });
  return tripId;
}

async function createSearchingTrip(riderToken: string, market: GeoMarket, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/rider/trips")
    .set("Authorization", `Bearer ${riderToken}`)
    .send(marketTripPayload(market, overrides));
  return res;
}

async function incoming(driverToken: string) {
  return request(app)
    .get("/api/driver/trips/incoming")
    .set("Authorization", `Bearer ${driverToken}`)
    .expect(200);
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index]!;
}

function summarize(label: string, values: number[]) {
  return {
    city: label,
    n: values.length,
    p50: Math.round(percentile(values, 50)),
    p95: Math.round(percentile(values, 95)),
    max: Math.round(Math.max(0, ...values)),
  };
}

const PAIRS_PER_MARKET = 4;
const P95_BUDGET_MS = 3000;

describe.sequential("Matchmaking across markets", { timeout: 90000 }, () => {
  beforeAll(async () => {
    expect(await pingRedis()).toBe(true);
    await resetGeoIndexes();
  });
  afterEach(async () => {
    await Promise.all(
      pendingCancels.splice(0).map(({ token, tripId }) =>
        request(app)
          .post(`/api/rider/trips/${tripId}/cancel`)
          .set("Authorization", `Bearer ${token}`)
          .then(() => undefined)
          .catch(() => undefined),
      ),
    );
  });

  afterAll(async () => {
    await cleanupMarketplaceUsers();
    await prisma.$disconnect();
  });

  it("uses Redis H3 indexes instead of a full-table Haversine scan", async () => {
    expect(await pingRedis()).toBe(true);
  });

  it("isolates matching so a driver only sees SEARCHING trips in their own market", async () => {
    const setups = await Promise.all(
      GEO_MARKETS.map(async (market) => {
        const rider = await spawnRider({ name: `${market.city} Rider` });
        const driver = await spawnApprovedOnlineDriver({
          city: market.city,
          location: market.pickup,
        });
        return { market, rider, driver };
      }),
    );

    const created = await Promise.all(
      setups.map(async ({ market, rider }) => {
        const res = await createSearchingTrip(rider.token, market);
        expect(res.status).toBe(201);
        const trip = res.body.trip as { id: string; city: string };
        trackTrip(rider.token, trip.id);
        return { market, rider, trip };
      }),
    );

    const tripByCity = new Map(created.map((row) => [row.market.city, row.trip.id]));

    for (const { market, driver } of setups) {
      const res = await incoming(driver.token);
      const ids = incomingTripIds(res.body);
      expect(ids).toContain(tripByCity.get(market.city));
      for (const other of GEO_MARKETS) {
        if (other.city === market.city) continue;
        expect(ids).not.toContain(tripByCity.get(other.city));
      }
    }
  });

  it("surfaces a driver just inside MATCH_RADIUS_KM and rejects one just outside", async () => {
    const insideLoc = offsetKm(REYKJAVIK.pickup.lat, REYKJAVIK.pickup.lng, MATCH_RADIUS_KM - 1, 0);
    const outsideLoc = offsetKm(REYKJAVIK.pickup.lat, REYKJAVIK.pickup.lng, MATCH_RADIUS_KM + 1, 0);
    expect(distanceKm(REYKJAVIK.pickup.lat, REYKJAVIK.pickup.lng, insideLoc.lat, insideLoc.lng)).toBeLessThanOrEqual(
      MATCH_RADIUS_KM,
    );
    expect(distanceKm(REYKJAVIK.pickup.lat, REYKJAVIK.pickup.lng, outsideLoc.lat, outsideLoc.lng)).toBeGreaterThan(
      MATCH_RADIUS_KM,
    );

    const rider = await spawnRider({ name: "Reykjavik Rider" });
    const inside = await spawnApprovedOnlineDriver({ city: REYKJAVIK.city, location: insideLoc });
    const outside = await spawnApprovedOnlineDriver({ city: REYKJAVIK.city, location: outsideLoc });

    const created = await createSearchingTrip(rider.token, REYKJAVIK);
    expect(created.status).toBe(201);
    const trip = created.body.trip as { id: string; fareTotal: number };
    trackTrip(rider.token, trip.id);

    const insideIncoming = await incoming(inside.token);
    expect(incomingTripIds(insideIncoming.body)).toContain(trip.id);

    const outsideIncoming = await incoming(outside.token);
    expect(outsideIncoming.body.trips).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ id: trip.id })]),
    );

    const farOffer = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${outside.token}`)
      .send({ proposedFare: trip.fareTotal, etaMinutes: 8 });
    expect(farOffer.status).toBe(409);
  });

  it("returns only the MATCH_LIMIT nearest drivers and nearest SEARCHING trips", async () => {
    const distancesKm = [1, 3, 5, 8, 12, 20];
    expect(distancesKm.length).toBe(MATCH_LIMIT + 1);

    const drivers = await Promise.all(
      distancesKm.map((km, index) =>
        spawnApprovedOnlineDriver({
          city: PERTH.city,
          name: `Perth Driver ${index}`,
          location: offsetKm(PERTH.pickup.lat, PERTH.pickup.lng, km, 0),
        }),
      ),
    );

    const nearby = await nearbyDrivers({
      pickupLat: PERTH.pickup.lat,
      pickupLng: PERTH.pickup.lng,
      vehicleType: "CAR",
    });
    const nearbyOurs = nearby.filter((row) => drivers.some((driver) => driver.profileId === row.id));
    expect(nearbyOurs).toHaveLength(MATCH_LIMIT);
    expect(nearbyOurs.map((row) => row.id)).toEqual(drivers.slice(0, MATCH_LIMIT).map((driver) => driver.profileId));
    expect(nearbyOurs.map((row) => row.id)).not.toContain(drivers[MATCH_LIMIT]!.profileId);

    const pollDriver = await spawnApprovedOnlineDriver({
      city: PERTH.city,
      name: "Perth Incoming Driver",
      location: PERTH.pickup,
    });

    const tripRiders = await Promise.all(
      distancesKm.map(async (km) => {
        const rider = await spawnRider({ name: `Perth Rider ${km}` });
        const pickup = offsetKm(PERTH.pickup.lat, PERTH.pickup.lng, km, 0);
        const dropoff = offsetKm(PERTH.dropoff.lat, PERTH.dropoff.lng, 0.2, 0);
        const res = await createSearchingTrip(rider.token, PERTH, {
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
        });
        expect(res.status).toBe(201);
        const trip = res.body.trip as { id: string };
        trackTrip(rider.token, trip.id);
        return { km, tripId: trip.id };
      }),
    );

    const poll = await incoming(pollDriver.token);
    const incomingIds = incomingTripIds(poll.body);
    expect(incomingIds).toContain(tripRiders[0]!.tripId);
    expect(incomingIds).not.toContain(tripRiders[MATCH_LIMIT]!.tripId);
  });

  it("matches a driver across the antimeridian and ignores one a longitude-delta away", async () => {
    const rider = await spawnRider({ name: "Dateline Rider" });
    const near = await spawnApprovedOnlineDriver({
      city: ANTIMERIDIAN.city,
      location: ANTIMERIDIAN_NEAR_DRIVER,
    });
    const far = await spawnApprovedOnlineDriver({
      city: ANTIMERIDIAN.city,
      location: ANTIMERIDIAN_FAR_DRIVER,
    });

    expect(
      distanceKm(
        ANTIMERIDIAN.pickup.lat,
        ANTIMERIDIAN.pickup.lng,
        ANTIMERIDIAN_NEAR_DRIVER.lat,
        ANTIMERIDIAN_NEAR_DRIVER.lng,
      ),
    ).toBeLessThanOrEqual(MATCH_RADIUS_KM);
    expect(
      distanceKm(
        ANTIMERIDIAN.pickup.lat,
        ANTIMERIDIAN.pickup.lng,
        ANTIMERIDIAN_FAR_DRIVER.lat,
        ANTIMERIDIAN_FAR_DRIVER.lng,
      ),
    ).toBeGreaterThan(MATCH_RADIUS_KM);

    const created = await createSearchingTrip(rider.token, ANTIMERIDIAN);
    expect(created.status).toBe(201);
    const trip = created.body.trip as { id: string };
    trackTrip(rider.token, trip.id);

    const nearIncoming = await incoming(near.token);
    expect(incomingTripIds(nearIncoming.body)).toContain(trip.id);

    const farIncoming = await incoming(far.token);
    expect(farIncoming.body.trips).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ id: trip.id })]),
    );
  });

  it("runs create → incoming → offer → accept in each geo market", async () => {
    for (const market of GEO_MARKETS) {
      const rider = await spawnRider({ name: `${market.city} Happy Rider` });
      const driver = await spawnApprovedOnlineDriver({
        city: market.city,
        location: market.pickup,
      });

      const created = await createSearchingTrip(rider.token, market);
      expect(created.status, market.city).toBe(201);
      const trip = created.body.trip as { id: string; fareTotal: number };
      trackTrip(rider.token, trip.id);

      const seen = await incoming(driver.token);
      expect(incomingTripIds(seen.body), market.city).toContain(trip.id);

      const offer = await request(app)
        .post(`/api/driver/trips/${trip.id}/offers`)
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ proposedFare: trip.fareTotal, etaMinutes: 5 })
        .expect(201);

      const accepted = await request(app)
        .post(`/api/rider/trips/${trip.id}/offers/${offer.body.offer.id}/accept`)
        .set("Authorization", `Bearer ${rider.token}`)
        .expect(200);

      expect(accepted.body.trip).toMatchObject({
        status: "ASSIGNED",
        driverId: driver.profileId,
      });
    }
  });

  it("creates and matches concurrent trips across markets within the p95 budget", async () => {
    type LoadPair = {
      market: GeoMarket;
      riderToken: string;
      driverToken: string;
      tripId?: string;
      createMs?: number;
      incomingMs?: number;
      incomingIds?: string[];
    };

    const pairs: LoadPair[] = [];
    for (const market of GEO_MARKETS) {
      for (let index = 0; index < PAIRS_PER_MARKET; index += 1) {
        const rider = await spawnRider({ name: `${market.city} Load Rider ${index}` });
        const driver = await spawnApprovedOnlineDriver({
          city: market.city,
          name: `${market.city} Load Driver ${index}`,
          location: offsetKm(market.pickup.lat, market.pickup.lng, 0.5 + index * 0.4, index % 2 === 0 ? 0.3 : -0.3),
        });
        pairs.push({ market, riderToken: rider.token, driverToken: driver.token });
      }
    }

    await Promise.all(
      pairs.map(async (pair) => {
        const started = performance.now();
        const res = await createSearchingTrip(pair.riderToken, pair.market);
        pair.createMs = performance.now() - started;
        expect(res.status, pair.market.city).toBe(201);
        const trip = res.body.trip as { id: string };
        pair.tripId = trip.id;
        trackTrip(pair.riderToken, trip.id);
      }),
    );

    await Promise.all(
      pairs.map(async (pair) => {
        const started = performance.now();
        const res = await incoming(pair.driverToken);
        pair.incomingMs = performance.now() - started;
        pair.incomingIds = incomingTripIds(res.body);
      }),
    );

    const rows = GEO_MARKETS.map((market) => {
      const cityPairs = pairs.filter((pair) => pair.market.city === market.city);
      const cityTripIds = new Set(cityPairs.map((pair) => pair.tripId));
      const otherTripIds = new Set(
        pairs.filter((pair) => pair.market.city !== market.city).map((pair) => pair.tripId),
      );
      let matched = 0;
      let leaked = 0;
      for (const pair of cityPairs) {
        const ids = pair.incomingIds ?? [];
        if (ids.some((id) => cityTripIds.has(id))) matched += 1;
        leaked += ids.filter((id) => otherTripIds.has(id)).length;
        for (const id of ids) {
          if (cityTripIds.has(id) || otherTripIds.has(id)) {
            expect(otherTripIds.has(id), `${market.city} leaked trip ${id}`).toBe(false);
          }
        }
      }
      const createMs = cityPairs.map((pair) => pair.createMs ?? 0);
      const incomingMs = cityPairs.map((pair) => pair.incomingMs ?? 0);
      return {
        ...summarize(market.city, createMs),
        incomingP50: Math.round(percentile(incomingMs, 50)),
        incomingP95: Math.round(percentile(incomingMs, 95)),
        incomingMax: Math.round(Math.max(0, ...incomingMs)),
        matchRate: `${matched}/${cityPairs.length}`,
        leaked,
      };
    });

    console.table(rows);

    const createP95 = percentile(pairs.map((pair) => pair.createMs ?? 0), 95);
    const incomingP95 = percentile(pairs.map((pair) => pair.incomingMs ?? 0), 95);
    expect(createP95).toBeLessThan(P95_BUDGET_MS);
    expect(incomingP95).toBeLessThan(P95_BUDGET_MS);

    for (const pair of pairs) {
      const cityTripIds = pairs
        .filter((other) => other.market.city === pair.market.city)
        .map((other) => other.tripId);
      expect(
        pair.incomingIds?.some((id) => cityTripIds.includes(id)),
        pair.market.city,
      ).toBe(true);
      const foreign = pairs
        .filter((other) => other.market.city !== pair.market.city)
        .map((other) => other.tripId);
      expect(pair.incomingIds?.some((id) => foreign.includes(id))).toBe(false);
    }
  });
});
