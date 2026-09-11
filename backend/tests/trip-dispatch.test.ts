import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import app from "./helpers/test-app.js";
import { prisma } from "@eve/db";
import { createTripDispatches } from "../services/ride/src/dispatch.js";
import {
  cleanupMarketplaceUsers,
  incomingTripIds,
  nycTripPayload,
  spawnApprovedOnlineDriver,
  spawnRider,
} from "./helpers/marketplace.js";

describe("Trip dispatch acceptance rate", () => {
  afterEach(async () => {
    await cleanupMarketplaceUsers();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createNearbyTrip() {
    const rider = await spawnRider({ name: "Dispatch Rider" });
    const driver = await spawnApprovedOnlineDriver({ name: "Dispatch Driver" });
    const created = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${rider.token}`)
      .send(nycTripPayload())
      .expect(201);
    const trip = created.body.trip as { id: string; fareTotal: number };
    const existing = await prisma.tripDispatch.findFirst({
      where: { tripId: trip.id, driverId: driver.profileId },
    });
    if (!existing) {
      await createTripDispatches(trip.id, [driver.profileId]);
    }
    return { rider, driver, trip };
  }

  it("creates a 30s dispatch for a nearby driver", async () => {
    const { driver, trip } = await createNearbyTrip();
    const incoming = await request(app)
      .get("/api/driver/trips/incoming")
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(200);
    expect(incoming.body.activeDispatch).toMatchObject({ tripId: trip.id });
    const remainingMs = new Date(incoming.body.activeDispatch.expiresAt).getTime() - Date.now();
    expect(remainingMs).toBeGreaterThan(25_000);
    expect(remainingMs).toBeLessThanOrEqual(35_000);
    const row = await prisma.tripDispatch.findFirst({ where: { tripId: trip.id, driverId: driver.profileId } });
    expect(row?.status).toBe("PENDING");
  });

  it("records an immediate decline against acceptance rate", async () => {
    const { driver, trip } = await createNearbyTrip();
    await request(app)
      .post(`/api/driver/trips/${trip.id}/dispatch/decline`)
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(200);
    const row = await prisma.tripDispatch.findFirst({ where: { tripId: trip.id, driverId: driver.profileId } });
    expect(row?.status).toBe("DECLINED");
    const profile = await prisma.driverProfile.findUnique({ where: { id: driver.profileId } });
    expect(Number(profile?.acceptanceRate)).toBe(0);
    const incoming = await request(app)
      .get("/api/driver/trips/incoming")
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(200);
    expect(incomingTripIds(incoming.body)).not.toContain(trip.id);
    expect(incoming.body.activeDispatch).toBeNull();
    await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ proposedFare: trip.fareTotal, etaMinutes: 5 })
      .expect(409);
  });

  it("expires a timed-out dispatch and lowers acceptance rate", async () => {
    const { driver, trip } = await createNearbyTrip();
    await prisma.tripDispatch.updateMany({
      where: { tripId: trip.id, driverId: driver.profileId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const incoming = await request(app)
      .get("/api/driver/trips/incoming")
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(200);
    const row = await prisma.tripDispatch.findFirst({ where: { tripId: trip.id, driverId: driver.profileId } });
    expect(row?.status).toBe("EXPIRED");
    expect(row?.voided).toBe(false);
    const profile = await prisma.driverProfile.findUnique({ where: { id: driver.profileId } });
    expect(Number(profile?.acceptanceRate)).toBe(0);
    expect(incomingTripIds(incoming.body)).not.toContain(trip.id);
    expect(incoming.body.activeDispatch).toBeNull();
  });

  it("accepts a dispatch by creating a suggested-fare offer", async () => {
    const { driver, trip } = await createNearbyTrip();
    const accepted = await request(app)
      .post(`/api/driver/trips/${trip.id}/dispatch/accept`)
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ proposedFare: trip.fareTotal })
      .expect(201);
    expect(accepted.body.offer).toMatchObject({ tripId: trip.id, status: "PENDING" });
    expect(Number(accepted.body.offer.proposedFare)).toBe(trip.fareTotal);
    const row = await prisma.tripDispatch.findFirst({ where: { tripId: trip.id, driverId: driver.profileId } });
    expect(row?.status).toBe("ACCEPTED");
    const profile = await prisma.driverProfile.findUnique({ where: { id: driver.profileId } });
    expect(Number(profile?.acceptanceRate)).toBe(100);
  });

  it("does not count other drivers when the trip is assigned", async () => {
    const rider = await spawnRider({ name: "Dispatch Pair Rider" });
    const winner = await spawnApprovedOnlineDriver({ name: "Dispatch Winner" });
    const other = await spawnApprovedOnlineDriver({ name: "Dispatch Other" });
    const created = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${rider.token}`)
      .send(nycTripPayload())
      .expect(201);
    const trip = created.body.trip as { id: string; fareTotal: number };
    await createTripDispatches(trip.id, [winner.profileId, other.profileId]);

    await request(app)
      .post(`/api/driver/trips/${trip.id}/dispatch/accept`)
      .set("Authorization", `Bearer ${winner.token}`)
      .expect(201);
    const offers = await request(app)
      .get(`/api/rider/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${rider.token}`)
      .expect(200);
    const offerId = (offers.body.offers as { id: string }[])[0]?.id;
    expect(offerId).toBeTruthy();
    await prisma.driverProfile.update({
      where: { id: other.profileId },
      data: { acceptanceRate: 42 },
    });

    await request(app)
      .post(`/api/rider/trips/${trip.id}/offers/${offerId}/accept`)
      .set("Authorization", `Bearer ${rider.token}`)
      .expect(200);

    const otherDispatch = await prisma.tripDispatch.findFirst({
      where: { tripId: trip.id, driverId: other.profileId },
    });
    expect(otherDispatch?.status).toBe("EXPIRED");
    expect(otherDispatch?.voided).toBe(true);
    const otherProfile = await prisma.driverProfile.findUnique({ where: { id: other.profileId } });
    expect(Number(otherProfile?.acceptanceRate)).toBe(42);
    const winnerProfile = await prisma.driverProfile.findUnique({ where: { id: winner.profileId } });
    expect(Number(winnerProfile?.acceptanceRate)).toBe(100);
  }, 20_000);

  it("still surfaces a declined trip to another nearby driver", async () => {
    const rider = await spawnRider({ name: "Dispatch Shared Rider" });
    const skipped = await spawnApprovedOnlineDriver({ name: "Dispatch Skip" });
    const other = await spawnApprovedOnlineDriver({ name: "Dispatch Still Sees" });
    const created = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${rider.token}`)
      .send(nycTripPayload())
      .expect(201);
    const trip = created.body.trip as { id: string; fareTotal: number };
    await createTripDispatches(trip.id, [skipped.profileId, other.profileId]);

    await request(app)
      .post(`/api/driver/trips/${trip.id}/dispatch/decline`)
      .set("Authorization", `Bearer ${skipped.token}`)
      .expect(200);

    const skippedIncoming = await request(app)
      .get("/api/driver/trips/incoming")
      .set("Authorization", `Bearer ${skipped.token}`)
      .expect(200);
    expect(incomingTripIds(skippedIncoming.body)).not.toContain(trip.id);

    const otherIncoming = await request(app)
      .get("/api/driver/trips/incoming")
      .set("Authorization", `Bearer ${other.token}`)
      .expect(200);
    expect(incomingTripIds(otherIncoming.body)).toContain(trip.id);
  }, 20_000);
});
