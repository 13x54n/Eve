import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

const createdEmails: string[] = [];

function registerDriver(vehicleType: "BIKE" | "CAR") {
  const email = `driver-${vehicleType.toLowerCase()}-${Date.now()}-${Math.random()}@example.com`;
  createdEmails.push(email);

  return request(app)
    .post("/api/auth/driver/register")
    .send({
      name: "Onboarding Driver",
      email,
      password: "password123",
      city: "New York",
      vehicleMake: vehicleType === "BIKE" ? "Honda" : "Toyota",
      vehicleModel: vehicleType === "BIKE" ? "CB125" : "Camry",
      vehicleYear: 2022,
      vehicleColor: "Black",
      vehiclePlateNumber: `${vehicleType.slice(0, 2)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      vehicleType,
      vehicleCapacity: vehicleType === "BIKE" ? 1 : 4,
    });
}

describe("Driver onboarding", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: createdEmails } },
    });
    await prisma.$disconnect();
  });

  it.each(["BIKE", "CAR"] as const)("registers a %s driver with a typed vehicle", async (vehicleType) => {
    const response = await registerDriver(vehicleType).expect(201);

    expect(response.body.user.role).toBe("DRIVER");
    expect(response.body.driverProfile.vehicles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          vehicleType,
          capacity: vehicleType === "BIKE" ? 1 : 4,
        }),
      ]),
    );
  });

  it("rejects an unknown vehicle type", async () => {
    const response = await request(app)
      .post("/api/auth/driver/register")
      .send({
        name: "Invalid Vehicle Driver",
        email: `invalid-vehicle-${Date.now()}@example.com`,
        password: "password123",
        vehiclePlateNumber: "INVALID-1",
        vehicleType: "SCOOTER",
      })
      .expect(400);

    expect(response.body.message).toBe("Invalid request data");
  });
});
