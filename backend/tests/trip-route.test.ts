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

const STOP_A = { address: "Stop A", lat: 40.73, lng: -73.99 };
const STOP_B = { address: "Stop B", lat: 40.74, lng: -73.98 };
const STOP_C = { address: "Stop C", lat: 40.75, lng: -73.975 };
const STOP_D = { address: "Stop D", lat: 40.755, lng: -73.97 };
const NEAR_PICKUP = { address: "Closer dropoff", lat: 40.7135, lng: -74.005 };

async function assignedTrip() {
  const rider = await spawnRider();
  const driver = await spawnApprovedOnlineDriver({ viaAdmin: true });
  const created = await request(app)
    .post("/api/rider/trips")
    .set("Authorization", `Bearer ${rider.token}`)
    .send(nycTripPayload())
    .expect(201);
  const trip = created.body.trip;
  const offer = await request(app)
    .post(`/api/driver/trips/${trip.id}/offers`)
    .set("Authorization", `Bearer ${driver.token}`)
    .send({ proposedFare: trip.fareTotal, etaMinutes: 5 })
    .expect(201);
  const accepted = await request(app)
    .post(`/api/rider/trips/${trip.id}/offers/${offer.body.offer.id}/accept`)
    .set("Authorization", `Bearer ${rider.token}`)
    .expect(200);
  return { rider, driver, trip: accepted.body.trip };
}

describe("In-trip route edits", { timeout: 20000 }, () => {
  afterAll(async () => {
    await cleanupMarketplaceUsers();
    await prisma.$disconnect();
  });

  it("rejects route edits while searching", async () => {
    const rider = await spawnRider();
    const created = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${rider.token}`)
      .send(nycTripPayload())
      .expect(201);

    await request(app)
      .post(`/api/rider/trips/${created.body.trip.id}/stops`)
      .set("Authorization", `Bearer ${rider.token}`)
      .send(STOP_A)
      .expect(409);

    await request(app)
      .patch(`/api/rider/trips/${created.body.trip.id}/destination`)
      .set("Authorization", `Bearer ${rider.token}`)
      .send(STOP_A)
      .expect(409);
  });

  it("adds stops, changes dropoff, and never lowers the matched fare", async () => {
    const { rider, trip } = await assignedTrip();
    const matchedFare = Number(trip.fareTotal);

    const withStop = await request(app)
      .post(`/api/rider/trips/${trip.id}/stops`)
      .set("Authorization", `Bearer ${rider.token}`)
      .send(STOP_A)
      .expect(200);
    expect(withStop.body.trip.stops).toHaveLength(1);
    expect(withStop.body.trip.rideType).toBe("MULTI_STOP");
    expect(Number(withStop.body.trip.fareTotal)).toBeGreaterThanOrEqual(matchedFare);

    const moved = await request(app)
      .patch(`/api/rider/trips/${trip.id}/destination`)
      .set("Authorization", `Bearer ${rider.token}`)
      .send(NEAR_PICKUP)
      .expect(200);
    expect(moved.body.trip.dropoffAddress).toBe(NEAR_PICKUP.address);
    expect(Number(moved.body.trip.fareTotal)).toBeGreaterThanOrEqual(Number(withStop.body.trip.fareTotal));

    await request(app)
      .post(`/api/rider/trips/${trip.id}/stops`)
      .set("Authorization", `Bearer ${rider.token}`)
      .send(STOP_B)
      .expect(200);
    await request(app)
      .post(`/api/rider/trips/${trip.id}/stops`)
      .set("Authorization", `Bearer ${rider.token}`)
      .send(STOP_C)
      .expect(200);
    const fourth = await request(app)
      .post(`/api/rider/trips/${trip.id}/stops`)
      .set("Authorization", `Bearer ${rider.token}`)
      .send(STOP_D)
      .expect(409);
    expect(fourth.body.message).toMatch(/3 stops/i);
  });

  it("lets courier change dropoff but rejects stops", async () => {
    const rider = await spawnRider();
    const driver = await spawnApprovedOnlineDriver({ viaAdmin: true });
    const created = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${rider.token}`)
      .send(nycTripPayload({
        rideType: "COURIER",
        recipientName: "Recipient",
        recipientPhone: "+15559876543",
      }))
      .expect(201);
    const trip = created.body.trip;
    const offer = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ proposedFare: trip.fareTotal, etaMinutes: 5 })
      .expect(201);
    await request(app)
      .post(`/api/rider/trips/${trip.id}/offers/${offer.body.offer.id}/accept`)
      .set("Authorization", `Bearer ${rider.token}`)
      .expect(200);

    const stop = await request(app)
      .post(`/api/rider/trips/${trip.id}/stops`)
      .set("Authorization", `Bearer ${rider.token}`)
      .send(STOP_A)
      .expect(409);
    expect(stop.body.message).toMatch(/cannot add stops/i);

    const moved = await request(app)
      .patch(`/api/rider/trips/${trip.id}/destination`)
      .set("Authorization", `Bearer ${rider.token}`)
      .send(STOP_A)
      .expect(200);
    expect(moved.body.trip.dropoffAddress).toBe(STOP_A.address);
    expect(moved.body.trip.rideType).toBe("COURIER");
    expect(moved.body.trip.stops ?? []).toHaveLength(0);
  });
});
