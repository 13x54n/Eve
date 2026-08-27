import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

const createdEmails: string[] = [];

// Pickup/dropoff coordinates both inside New York, ~5km apart.
const PICKUP = { lat: 40.7128, lng: -74.006 };
const DROPOFF = { lat: 40.758, lng: -73.9855 };
const FAR_AWAY = { lat: 34.0522, lng: -118.2437 }; // Los Angeles — outside the 25km match radius

function registerRider() {
  const email = `rider-match-${Date.now()}-${Math.random()}@example.com`;
  createdEmails.push(email);
  return request(app)
    .post("/api/auth/register")
    .send({ name: "Matchmaking Rider", email, password: "password123" });
}

function registerDriver(options: { city?: string; vehicleType?: "BIKE" | "CAR" } = {}) {
  const email = `driver-match-${Date.now()}-${Math.random()}@example.com`;
  createdEmails.push(email);
  const vehicleType = options.vehicleType ?? "CAR";
  return request(app)
    .post("/api/auth/driver/register")
    .send({
      name: "Matchmaking Driver",
      email,
      password: "password123",
      city: options.city ?? "New York",
      vehicleMake: "Toyota",
      vehicleModel: "Camry",
      vehicleYear: 2022,
      vehicleColor: "Black",
      vehiclePlateNumber: `MM${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
      vehicleType,
      vehicleCapacity: 4,
    });
}

async function approveDriver(driverProfileId: string) {
  await prisma.driverProfile.update({
    where: { id: driverProfileId },
    data: { approvalStatus: "APPROVED" },
  });
}

async function goOnline(token: string, location: { lat: number; lng: number }) {
  return request(app)
    .patch("/api/driver/presence")
    .set("Authorization", `Bearer ${token}`)
    .send({ presence: "ONLINE", latitude: location.lat, longitude: location.lng })
    .expect(200);
}

describe("Rider-driver matchmaking", () => {
  afterAll(async () => {
    const riders = await prisma.riderProfile.findMany({
      where: { user: { email: { in: createdEmails } } },
      select: { id: true },
    });
    const riderIds = riders.map((rider) => rider.id);
    const trips = await prisma.trip.findMany({
      where: { riderId: { in: riderIds } },
      select: { id: true },
    });
    const tripIds = trips.map((trip) => trip.id);

    await prisma.tripOffer.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await prisma.$disconnect();
  });

  it(
    "notifies a nearby, online, approved driver of a matching trip and lets them offer a fare",
    async () => {
    const riderRes = await registerRider().expect(201);
    const riderToken = riderRes.body.accessToken;

    const driverRes = await registerDriver().expect(201);
    const driverToken = driverRes.body.accessToken;
    const driverProfileId = driverRes.body.driverProfile.id;

    await approveDriver(driverProfileId);
    await goOnline(driverToken, PICKUP);

    const tripRes = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${riderToken}`)
      .send({
        pickupAddress: "Pickup St",
        dropoffAddress: "Dropoff Ave",
        city: "New York",
        pickupLat: PICKUP.lat,
        pickupLng: PICKUP.lng,
        dropoffLat: DROPOFF.lat,
        dropoffLng: DROPOFF.lng,
        vehicleType: "CAR",
      })
      .expect(201);

    const trip = tripRes.body.trip;
    expect(trip.status).toBe("SEARCHING");

    const incomingRes = await request(app)
      .get("/api/driver/trips/incoming")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(incomingRes.body.trips).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: trip.id })]),
    );

    const offerRes = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ proposedFare: trip.fareTotal, etaMinutes: 5 })
      .expect(201);

    expect(offerRes.body.offer).toMatchObject({ tripId: trip.id, status: "PENDING" });

    const offersRes = await request(app)
      .get(`/api/rider/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${riderToken}`)
      .expect(200);

    expect(offersRes.body.offers).toHaveLength(1);
    const offerId = offersRes.body.offers[0].id;

    const acceptRes = await request(app)
      .post(`/api/rider/trips/${trip.id}/offers/${offerId}/accept`)
      .set("Authorization", `Bearer ${riderToken}`)
      .expect(200);

    expect(acceptRes.body.trip).toMatchObject({
      status: "ASSIGNED",
      driverId: driverProfileId,
    });
    },
    15000,
  );

  it("does not surface a trip to a driver who is offline", async () => {
    const riderRes = await registerRider().expect(201);
    const riderToken = riderRes.body.accessToken;

    const driverRes = await registerDriver().expect(201);
    const driverToken = driverRes.body.accessToken;
    await approveDriver(driverRes.body.driverProfile.id);
    // Driver stays OFFLINE (never calls goOnline).

    await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${riderToken}`)
      .send({
        pickupAddress: "Pickup St",
        dropoffAddress: "Dropoff Ave",
        city: "New York",
        pickupLat: PICKUP.lat,
        pickupLng: PICKUP.lng,
        dropoffLat: DROPOFF.lat,
        dropoffLng: DROPOFF.lng,
        vehicleType: "CAR",
      })
      .expect(201);

    const incomingRes = await request(app)
      .get("/api/driver/trips/incoming")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(incomingRes.body.trips).toEqual([]);
  });

  it("does not surface a trip to an online driver who is too far away", async () => {
    const riderRes = await registerRider().expect(201);
    const riderToken = riderRes.body.accessToken;

    const driverRes = await registerDriver().expect(201);
    const driverToken = driverRes.body.accessToken;
    await approveDriver(driverRes.body.driverProfile.id);
    await goOnline(driverToken, FAR_AWAY);

    const tripRes = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${riderToken}`)
      .send({
        pickupAddress: "Pickup St",
        dropoffAddress: "Dropoff Ave",
        city: "New York",
        pickupLat: PICKUP.lat,
        pickupLng: PICKUP.lng,
        dropoffLat: DROPOFF.lat,
        dropoffLng: DROPOFF.lng,
        vehicleType: "CAR",
      })
      .expect(201);

    const incomingRes = await request(app)
      .get("/api/driver/trips/incoming")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(incomingRes.body.trips).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ id: tripRes.body.trip.id })]),
    );
  });

  it("does not surface a trip to a driver with a mismatched vehicle type", async () => {
    const riderRes = await registerRider().expect(201);
    const riderToken = riderRes.body.accessToken;

    const bikeDriverRes = await registerDriver({ vehicleType: "BIKE" }).expect(201);
    const bikeDriverToken = bikeDriverRes.body.accessToken;
    await approveDriver(bikeDriverRes.body.driverProfile.id);
    await goOnline(bikeDriverToken, PICKUP);

    const tripRes = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${riderToken}`)
      .send({
        pickupAddress: "Pickup St",
        dropoffAddress: "Dropoff Ave",
        city: "New York",
        pickupLat: PICKUP.lat,
        pickupLng: PICKUP.lng,
        dropoffLat: DROPOFF.lat,
        dropoffLng: DROPOFF.lng,
        vehicleType: "CAR",
      })
      .expect(201);

    const incomingRes = await request(app)
      .get("/api/driver/trips/incoming")
      .set("Authorization", `Bearer ${bikeDriverToken}`)
      .expect(200);

    expect(incomingRes.body.trips).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ id: tripRes.body.trip.id })]),
    );
  });

  it("blocks a driver from going online before their account is approved", async () => {
    const driverRes = await registerDriver().expect(201);
    const driverToken = driverRes.body.accessToken;
    // Not approved — still PENDING by default.

    const response = await request(app)
      .patch("/api/driver/presence")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ presence: "ONLINE", latitude: PICKUP.lat, longitude: PICKUP.lng })
      .expect(401);

    expect(response.body.message).toMatch(/under review/i);
  });
});
