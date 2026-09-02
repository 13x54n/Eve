import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "./helpers/test-app.js";
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

describe("Trip assignment races", { timeout: 20000 }, () => {
  afterAll(async () => {
    await cleanupMarketplaceUsers();
    await prisma.$disconnect();
  });

  it("accepts one of two offers and rejects the other", async () => {
    const rider = await spawnRider();
    const driverA = await spawnApprovedOnlineDriver();
    const driverB = await spawnApprovedOnlineDriver();
    const trip = await createSearchingTrip(rider.token);

    const offerA = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driverA.token}`)
      .send({ proposedFare: trip.fareTotal, etaMinutes: 5 })
      .expect(201);
    const offerB = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driverB.token}`)
      .send({ proposedFare: trip.fareTotal, etaMinutes: 7 })
      .expect(201);

    const accepted = await request(app)
      .post(`/api/rider/trips/${trip.id}/offers/${offerA.body.offer.id}/accept`)
      .set("Authorization", `Bearer ${rider.token}`)
      .expect(200);

    expect(accepted.body.trip.driverId).toBe(driverA.profileId);
    expect(accepted.body.trip.status).toBe("ASSIGNED");

    const detail = await request(app)
      .get(`/api/rider/trips/${trip.id}`)
      .set("Authorization", `Bearer ${rider.token}`)
      .expect(200);
    const offers = detail.body.trip.offers ?? [];
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: offerA.body.offer.id, status: "ACCEPTED" }),
        expect.objectContaining({ id: offerB.body.offer.id, status: "REJECTED" }),
      ]),
    );
  });

  it("allows only one concurrent accept on the same trip", async () => {
    const rider = await spawnRider();
    const driverA = await spawnApprovedOnlineDriver();
    const driverB = await spawnApprovedOnlineDriver();
    const trip = await createSearchingTrip(rider.token);

    const offerA = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driverA.token}`)
      .send({ proposedFare: trip.fareTotal, etaMinutes: 5 })
      .expect(201);
    const offerB = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driverB.token}`)
      .send({ proposedFare: trip.fareTotal, etaMinutes: 5 })
      .expect(201);

    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/rider/trips/${trip.id}/offers/${offerA.body.offer.id}/accept`)
        .set("Authorization", `Bearer ${rider.token}`),
      request(app)
        .post(`/api/rider/trips/${trip.id}/offers/${offerB.body.offer.id}/accept`)
        .set("Authorization", `Bearer ${rider.token}`),
    ]);

    expect([first.status, second.status]).toContain(200);
    for (const status of [first.status, second.status]) {
      expect([200, 409]).toContain(status);
    }

    const stored = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(stored?.status).toBe("ASSIGNED");
    expect([driverA.profileId, driverB.profileId]).toContain(stored?.driverId);

    const acceptedOffers = await prisma.tripOffer.count({
      where: { tripId: trip.id, status: "ACCEPTED" },
    });
    expect(acceptedOffers).toBeGreaterThanOrEqual(1);
    expect(new Set([stored?.driverId]).size).toBe(1);
  });

  it("assigns a trip to only one driver when legacy accept races an offer accept", async () => {
    const rider = await spawnRider();
    const offering = await spawnApprovedOnlineDriver();
    const legacy = await spawnApprovedOnlineDriver();
    const trip = await createSearchingTrip(rider.token);

    const offer = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${offering.token}`)
      .send({ proposedFare: trip.fareTotal, etaMinutes: 5 })
      .expect(201);

    const [offerAccept, legacyAccept] = await Promise.all([
      request(app)
        .post(`/api/rider/trips/${trip.id}/offers/${offer.body.offer.id}/accept`)
        .set("Authorization", `Bearer ${rider.token}`),
      request(app)
        .post(`/api/driver/trips/${trip.id}/accept`)
        .set("Authorization", `Bearer ${legacy.token}`),
    ]);

    const stored = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(stored?.status).toBe("ASSIGNED");
    expect([offering.profileId, legacy.profileId]).toContain(stored?.driverId);

    const okCount = [offerAccept.status, legacyAccept.status].filter((status) => status === 200).length;
    expect(okCount).toBeGreaterThanOrEqual(1);
    expect(new Set([stored?.driverId]).size).toBe(1);
  });
});
