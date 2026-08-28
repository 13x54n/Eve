import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../gateway/src/app.js";
import { prisma } from "@eve/db";
import {
  cleanupMarketplaceUsers,
  nycTripPayload,
  spawnApprovedOnlineDriver,
  spawnRider,
} from "./helpers/marketplace.js";

async function createSearchingTrip(riderToken: string) {
  const res = await request(app)
    .post("/api/rider/trips")
    .set("Authorization", `Bearer ${riderToken}`)
    .send(nycTripPayload())
    .expect(201);
  return res.body.trip;
}

describe("Trip lifecycle", { timeout: 20000 }, () => {
  afterAll(async () => {
    await cleanupMarketplaceUsers();
    await prisma.$disconnect();
  });

  it(
    "runs SEARCHING → offer → accept → arrived → start → complete with ledger",
    async () => {
      const rider = await spawnRider();
      const driver = await spawnApprovedOnlineDriver({ viaAdmin: true });
      const before = await request(app)
        .get("/api/driver/me")
        .set("Authorization", `Bearer ${driver.token}`)
        .expect(200);
      const earningsBefore = Number(before.body.driver.earningsTotal);

      const trip = await createSearchingTrip(rider.token);
      expect(trip.status).toBe("SEARCHING");
      expect(trip.suggestedFare).toBeGreaterThan(0);
      expect(trip.fareTotal).toBe(trip.suggestedFare);
      expect(trip.commission).toBeUndefined();

      const incoming = await request(app)
        .get("/api/driver/trips/incoming")
        .set("Authorization", `Bearer ${driver.token}`)
        .expect(200);
      expect(incoming.body.trips).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: trip.id })]),
      );

      const proposedFare = Number((Number(trip.fareTotal) + 1).toFixed(2));
      const offerRes = await request(app)
        .post(`/api/driver/trips/${trip.id}/offers`)
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ proposedFare, etaMinutes: 6 })
        .expect(201);
      expect(offerRes.body.offer.status).toBe("PENDING");

      const acceptRes = await request(app)
        .post(`/api/rider/trips/${trip.id}/offers/${offerRes.body.offer.id}/accept`)
        .set("Authorization", `Bearer ${rider.token}`)
        .expect(200);
      expect(acceptRes.body.trip).toMatchObject({
        status: "ASSIGNED",
        driverId: driver.profileId,
        fareTotal: proposedFare,
      });

      const assignedDriver = await request(app)
        .get("/api/driver/me")
        .set("Authorization", `Bearer ${driver.token}`)
        .expect(200);
      expect(assignedDriver.body.driver.presence).toBe("ON_TRIP");

      await request(app)
        .post(`/api/driver/trips/${trip.id}/arrived`)
        .set("Authorization", `Bearer ${driver.token}`)
        .expect(200);

      const started = await request(app)
        .post(`/api/driver/trips/${trip.id}/start`)
        .set("Authorization", `Bearer ${driver.token}`)
        .expect(200);
      expect(started.body.trip.status).toBe("ONGOING");

      const completed = await request(app)
        .post(`/api/driver/trips/${trip.id}/complete`)
        .set("Authorization", `Bearer ${driver.token}`)
        .send({ rating: 5 })
        .expect(200);
      expect(completed.body.trip.status).toBe("COMPLETED");
      expect(completed.body.earnings.netEarnings).toBe(proposedFare);

      const ledger = await prisma.ledgerEntry.findFirst({ where: { tripId: trip.id } });
      expect(ledger).toMatchObject({ type: "CHARGE", status: "COMPLETED" });
      expect(ledger?.note).toMatch(/off-platform/i);

      const after = await request(app)
        .get("/api/driver/me")
        .set("Authorization", `Bearer ${driver.token}`)
        .expect(200);
      expect(after.body.driver.presence).toBe("ONLINE");
      expect(after.body.driver.earningsTotal).toBeCloseTo(earningsBefore + proposedFare, 2);
    },
    20000,
  );

  it("lets a rider cancel while SEARCHING", async () => {
    const rider = await spawnRider();
    const trip = await createSearchingTrip(rider.token);
    const cancelled = await request(app)
      .post(`/api/rider/trips/${trip.id}/cancel`)
      .set("Authorization", `Bearer ${rider.token}`)
      .expect(200);
    expect(cancelled.body.trip.status).toBe("CANCELLED");
  });

  it("lets a driver cancel while ASSIGNED and returns them ONLINE", async () => {
    const rider = await spawnRider();
    const driver = await spawnApprovedOnlineDriver();
    const trip = await createSearchingTrip(rider.token);
    const offer = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ proposedFare: trip.fareTotal, etaMinutes: 5 })
      .expect(201);
    await request(app)
      .post(`/api/rider/trips/${trip.id}/offers/${offer.body.offer.id}/accept`)
      .set("Authorization", `Bearer ${rider.token}`)
      .expect(200);

    const cancelled = await request(app)
      .post(`/api/driver/trips/${trip.id}/cancel`)
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ reason: "Rider no-show" })
      .expect(200);
    expect(cancelled.body.trip.status).toBe("CANCELLED");

    const me = await request(app)
      .get("/api/driver/me")
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(200);
    expect(me.body.driver.presence).toBe("ONLINE");
  });

  it("rejects offers below the base fare, above 2x, and duplicate offers", async () => {
    const rider = await spawnRider();
    const driver = await spawnApprovedOnlineDriver();
    const trip = await createSearchingTrip(rider.token);
    const base = Number(trip.fareTotal);

    const below = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ proposedFare: Number((base - 0.01).toFixed(2)), etaMinutes: 5 })
      .expect(409);
    expect(below.body.message).toMatch(/base fare/i);

    const above = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ proposedFare: Number((base * 2 + 0.01).toFixed(2)), etaMinutes: 5 })
      .expect(409);
    expect(above.body.message).toMatch(/double/i);

    await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ proposedFare: base, etaMinutes: 5 })
      .expect(201);

    const duplicate = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ proposedFare: base, etaMinutes: 5 })
      .expect(409);
    expect(duplicate.body.message).toMatch(/already offered|wait for your current offer/i);
  });
});
