import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "./helpers/test-app.js";
import { calculateFare, prisma } from "@eve/db";
import { distanceKm, durationMinutes } from "@eve/shared";
import {
  cleanupMarketplaceUsers,
  nycTripPayload,
  spawnRider,
  uniqueEmail,
} from "./helpers/marketplace.js";

describe("Fare and distance", { timeout: 20000 }, () => {
  afterAll(async () => {
    await prisma.fareConfig.deleteMany({ where: { city: "RegFareCity" } });
    await cleanupMarketplaceUsers();
    await prisma.$disconnect();
  });

  it("falls back to BIKE and CAR defaults when no ACTIVE config exists", async () => {
    const bike = await calculateFare("NoSuchMarket", "BIKE", 10, 10);
    expect(bike).toBe(Math.max(4, (4 + 10 * 0.8 + 10 * 0.25 + 1) * 1));

    const car = await calculateFare("NoSuchMarket", "CAR", 10, 10);
    expect(car).toBe(Math.max(8, (8 + 10 * 1.5 + 10 * 0.25 + 1) * 1));
  });

  it("applies minFare floor and surge from an ACTIVE config", async () => {
    const ownerEmail = uniqueEmail("admin");
    const owner = await prisma.user.create({
      data: {
        name: "Fare Config Owner",
        email: ownerEmail,
        passwordHash: "unused",
        role: "ADMIN",
        adminStaffRole: "OWNER",
      },
    });

    await prisma.fareConfig.create({
      data: {
        city: "RegFareCity",
        vehicleType: "CAR",
        baseFare: 10,
        perKm: 0,
        perMinute: 0,
        minFare: 50,
        bookingFee: 0,
        airportFee: 0,
        cancellationFee: 0,
        waitingFee: 0,
        surgeMultiplier: 2,
        status: "ACTIVE",
        effectiveAt: new Date(Date.now() - 60_000),
        createdById: owner.id,
      },
    });

    await prisma.fareConfig.create({
      data: {
        city: "RegFareCity",
        vehicleType: "BIKE",
        baseFare: 10,
        perKm: 0,
        perMinute: 0,
        minFare: 1,
        bookingFee: 0,
        airportFee: 0,
        cancellationFee: 0,
        waitingFee: 0,
        surgeMultiplier: 2,
        status: "ACTIVE",
        effectiveAt: new Date(Date.now() - 60_000),
        createdById: owner.id,
      },
    });

    const surgedFloor = await calculateFare("RegFareCity", "CAR", 1, 5);
    expect(surgedFloor).toBe(50);

    const surged = await calculateFare("RegFareCity", "BIKE", 1, 5);
    expect(surged).toBe(20);
  });

  it("computes haversine distance and duration floors", () => {
    const km = distanceKm(40.7128, -74.006, 40.758, -73.9855);
    expect(km).toBeGreaterThan(4);
    expect(km).toBeLessThan(8);
    expect(durationMinutes(0.1)).toBe(5);
    expect(durationMinutes(4.5)).toBe(10);
  });

  it("rejects a trip whose pickup and drop-off are the same location", async () => {
    const rider = await spawnRider();
    const response = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${rider.token}`)
      .send(
        nycTripPayload({
          dropoffLat: 40.7128,
          dropoffLng: -74.006,
        }),
      )
      .expect(409);

    expect(response.body.message).toMatch(/different locations/i);
  });

  it("returns suggestedFare without a commission field", async () => {
    const rider = await spawnRider();
    const response = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${rider.token}`)
      .send(nycTripPayload())
      .expect(201);

    expect(typeof response.body.trip.suggestedFare).toBe("number");
    expect(response.body.trip.suggestedFare).toBeGreaterThan(0);
    expect(response.body.trip.fareTotal).toBe(response.body.trip.suggestedFare);
    expect(response.body.trip.commission).toBeUndefined();
  });
});
