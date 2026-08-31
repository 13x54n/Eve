import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../gateway/src/app.js";
import { prisma } from "@eve/db";
import {
  cleanupMarketplaceUsers,
  nycTripPayload,
  spawnApprovedOnlineDriver,
  spawnRider,
  createAdminToken,
} from "./helpers/marketplace.js";

afterAll(async () => {
  await cleanupMarketplaceUsers();
  await prisma.$disconnect();
});

describe("Courier trips", { timeout: 20000 }, () => {

  it("creates a courier, notifies drivers, and exposes public + recipient tracking", async () => {
    const recipientPhone = `+1555${Date.now().toString().slice(-7)}`;
    const sender = await spawnRider();
    const recipient = await spawnRider({ name: "Recipient Rider", phone: recipientPhone });
    const driver = await spawnApprovedOnlineDriver({ viaAdmin: true });

    const created = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${sender.token}`)
      .send(nycTripPayload({
        rideType: "COURIER",
        recipientName: "Recipient Rider",
        recipientPhone,
        packageNote: "Documents",
      }))
      .expect(201);

    expect(created.body.trip).toMatchObject({
      rideType: "COURIER",
      recipientName: "Recipient Rider",
      recipientPhone,
      packageNote: "Documents",
      viewerRole: "sender",
      canManage: true,
    });
    expect(created.body.trip.trackingToken).toEqual(expect.any(String));
    expect(created.body.trip.recipientUserId).toBe(recipient.user.id);

    const incoming = await request(app)
      .get("/api/driver/trips/incoming")
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(200);
    expect(incoming.body.trips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.trip.id,
          rideType: "COURIER",
          recipientName: "Recipient Rider",
        }),
      ]),
    );

    const publicRes = await request(app)
      .get(`/api/public/courier/${created.body.trip.trackingToken}`)
      .expect(200);
    expect(publicRes.body.courier).toMatchObject({
      bookingCode: created.body.trip.bookingCode,
      status: "SEARCHING",
      pickupAddress: "Pickup St",
    });
    expect(publicRes.body.courier.fareTotal).toBeUndefined();

    const received = await request(app)
      .get("/api/rider/trips")
      .set("Authorization", `Bearer ${recipient.token}`)
      .expect(200);
    expect(received.body.trips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.trip.id,
          direction: "receiving",
          viewerRole: "recipient",
          canManage: false,
        }),
      ]),
    );

    const recipientTrip = await request(app)
      .get(`/api/rider/trips/${created.body.trip.id}`)
      .set("Authorization", `Bearer ${recipient.token}`)
      .expect(200);
    expect(recipientTrip.body.trip.offers).toBeUndefined();

    await request(app)
      .post(`/api/rider/trips/${created.body.trip.id}/cancel`)
      .set("Authorization", `Bearer ${recipient.token}`)
      .expect(404);
  });

  it("shows a BIKE courier to a nearby CAR driver", async () => {
    const sender = await spawnRider();
    const driver = await spawnApprovedOnlineDriver({ viaAdmin: true, vehicleType: "CAR" });

    const created = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${sender.token}`)
      .send(nycTripPayload({
        rideType: "COURIER",
        vehicleType: "BIKE",
        recipientName: "Package Recipient",
        recipientPhone: "+15551234567",
        packageNote: "Envelope",
      }))
      .expect(201);

    const incoming = await request(app)
      .get("/api/driver/trips/incoming")
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(200);
    expect(incoming.body.trips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.trip.id,
          rideType: "COURIER",
          vehicleType: "BIKE",
        }),
      ]),
    );

    await request(app)
      .post(`/api/driver/trips/${created.body.trip.id}/offers`)
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ proposedFare: created.body.trip.fareTotal, etaMinutes: 5 })
      .expect(201);
  });

  it("indexes admin-created SEARCHING courier trips for drivers", async () => {
    const rider = await spawnRider();
    const driver = await spawnApprovedOnlineDriver({ viaAdmin: true });
    const admin = await createAdminToken();

    const created = await request(app)
      .post("/api/admin/trips")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        riderId: rider.user.id,
        pickupAddress: "Pickup St",
        dropoffAddress: "Dropoff Ave",
        city: "New York",
        pickupLat: 40.7128,
        pickupLng: -74.006,
        dropoffLat: 40.758,
        dropoffLng: -73.9855,
        vehicleType: "BIKE",
        rideType: "COURIER",
      })
      .expect(201);

    const tripId = created.body.trip?.id ?? created.body.id;
    expect(tripId).toEqual(expect.any(String));

    const incoming = await request(app)
      .get("/api/driver/trips/incoming")
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(200);
    expect(incoming.body.trips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: tripId,
          rideType: "COURIER",
        }),
      ]),
    );
  });

  it("requires recipient details for courier trips", async () => {
    const sender = await spawnRider();
    await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${sender.token}`)
      .send(nycTripPayload({ rideType: "COURIER" }))
      .expect(400);
  });
});

describe("Book for others", { timeout: 20000 }, () => {
  it("creates a STANDARD trip with passenger tracking and blocks passenger cancel", async () => {
    const passengerPhone = `+1555${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 9)}`;
    const booker = await spawnRider();
    const passenger = await spawnRider({ name: "Passenger Rider", phone: passengerPhone });

    const created = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${booker.token}`)
      .send(nycTripPayload({
        recipientName: "Passenger Rider",
        recipientPhone: passengerPhone,
      }))
      .expect(201);

    expect(created.body.trip).toMatchObject({
      rideType: "STANDARD",
      recipientName: "Passenger Rider",
      recipientPhone: passengerPhone,
      viewerRole: "sender",
      canManage: true,
    });
    expect(created.body.trip.trackingToken).toEqual(expect.any(String));
    expect(created.body.trip.recipientUserId).toBe(passenger.user.id);

    const publicRes = await request(app)
      .get(`/api/public/courier/${created.body.trip.trackingToken}`)
      .expect(200);
    expect(publicRes.body.courier).toMatchObject({
      bookingCode: created.body.trip.bookingCode,
      status: "SEARCHING",
      rideType: "STANDARD",
    });
    expect(publicRes.body.courier.fareTotal).toBeUndefined();

    const received = await request(app)
      .get("/api/rider/trips")
      .set("Authorization", `Bearer ${passenger.token}`)
      .expect(200);
    expect(received.body.trips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.trip.id,
          direction: "receiving",
          viewerRole: "recipient",
          canManage: false,
        }),
      ]),
    );

    const passengerTrip = await request(app)
      .get(`/api/rider/trips/${created.body.trip.id}`)
      .set("Authorization", `Bearer ${passenger.token}`)
      .expect(200);
    expect(passengerTrip.body.trip.offers).toBeUndefined();

    await request(app)
      .post(`/api/rider/trips/${created.body.trip.id}/cancel`)
      .set("Authorization", `Bearer ${passenger.token}`)
      .expect(404);

    await request(app)
      .post(`/api/rider/trips/${created.body.trip.id}/cancel`)
      .set("Authorization", `Bearer ${booker.token}`)
      .expect(200);
  });

  it("requires both passenger name and phone when either is sent", async () => {
    const booker = await spawnRider();
    await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${booker.token}`)
      .send(nycTripPayload({ recipientName: "Only Name" }))
      .expect(400);
    await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${booker.token}`)
      .send(nycTripPayload({ recipientPhone: "+15550001111" }))
      .expect(400);
  });
});
