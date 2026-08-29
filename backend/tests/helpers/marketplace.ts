import request from "supertest";
import type { Test } from "supertest";
import app from "../../gateway/src/app.js";
import { prisma } from "@eve/db";
import { createAccessToken, hashPassword } from "@eve/shared";

export const PICKUP = { lat: 40.7128, lng: -74.006 };
export const DROPOFF = { lat: 40.758, lng: -73.9855 };
export const FAR_AWAY = { lat: 34.0522, lng: -118.2437 };
export const TEST_PASSWORD = "password123";
export const EMAIL_PREFIX = "reg-";

const trackedEmails: string[] = [];

function suffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function uniqueEmail(role: "rider" | "driver" | "admin") {
  const email = `${EMAIL_PREFIX}${role}-${suffix()}@example.com`;
  trackedEmails.push(email);
  return email;
}

export function nycTripPayload(overrides: Record<string, unknown> = {}) {
  return {
    pickupAddress: "Pickup St",
    dropoffAddress: "Dropoff Ave",
    city: "New York",
    pickupLat: PICKUP.lat,
    pickupLng: PICKUP.lng,
    dropoffLat: DROPOFF.lat,
    dropoffLng: DROPOFF.lng,
    vehicleType: "CAR",
    ...overrides,
  };
}

export function registerRider(name = "Regression Rider", phone?: string) {
  const email = uniqueEmail("rider");
  return {
    email,
    request: request(app).post("/api/auth/register").send({
      name,
      email,
      password: TEST_PASSWORD,
      ...(phone ? { phone } : {}),
    }) as Test,
  };
}

export function registerDriver(
  options: { city?: string; vehicleType?: "BIKE" | "CAR"; name?: string } = {},
) {
  const email = uniqueEmail("driver");
  const vehicleType = options.vehicleType ?? "CAR";
  return {
    email,
    request: request(app)
      .post("/api/auth/driver/register")
      .send({
        name: options.name ?? "Regression Driver",
        email,
        password: TEST_PASSWORD,
        city: options.city ?? "New York",
        vehicleMake: vehicleType === "BIKE" ? "Honda" : "Toyota",
        vehicleModel: vehicleType === "BIKE" ? "CB125" : "Camry",
        vehicleYear: 2022,
        vehicleColor: "Black",
        vehiclePlateNumber: `RG${suffix()}`.slice(0, 20).toUpperCase(),
        vehicleType,
        vehicleCapacity: vehicleType === "BIKE" ? 1 : 4,
      }) as Test,
  };
}

export async function approveDriver(driverProfileId: string) {
  await prisma.driverProfile.update({
    where: { id: driverProfileId },
    data: { approvalStatus: "APPROVED" },
  });
}

export async function createAdminToken() {
  const email = uniqueEmail("admin");
  const user = await prisma.user.create({
    data: {
      name: "Regression Admin",
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      role: "ADMIN",
      adminStaffRole: "OWNER",
    },
  });
  return {
    email,
    id: user.id,
    token: createAccessToken({
      id: user.id,
      role: "ADMIN",
      adminStaffRole: "OWNER",
    }),
  };
}

export function approveDriverViaApi(adminToken: string, driverProfileId: string) {
  return request(app)
    .patch(`/api/admin/drivers/${driverProfileId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ approvalStatus: "APPROVED" });
}

export function goOnline(token: string, location: { lat: number; lng: number } = PICKUP) {
  return request(app)
    .patch("/api/driver/presence")
    .set("Authorization", `Bearer ${token}`)
    .send({ presence: "ONLINE", latitude: location.lat, longitude: location.lng });
}

export async function spawnRider(options: { name?: string; phone?: string } = {}) {
  const { email, request: req } = registerRider(options.name, options.phone);
  const res = await req.expect(201);
  return { email, token: res.body.accessToken as string, user: res.body.user };
}

export async function spawnApprovedOnlineDriver(
  options: { city?: string; vehicleType?: "BIKE" | "CAR"; viaAdmin?: boolean } = {},
) {
  const { email, request: req } = registerDriver(options);
  const res = await req.expect(201);
  const profileId = res.body.driverProfile.id as string;
  const token = res.body.accessToken as string;
  if (options.viaAdmin) {
    const admin = await createAdminToken();
    await approveDriverViaApi(admin.token, profileId).expect(200);
  } else {
    await approveDriver(profileId);
  }
  await goOnline(token).expect(200);
  return { email, token, profileId, user: res.body.user };
}

export async function cleanupMarketplaceUsers(emails: string[] = trackedEmails) {
  const unique = [...new Set(emails)];
  if (unique.length === 0) {
    return;
  }

  const users = await prisma.user.findMany({
    where: { email: { in: unique } },
    select: {
      id: true,
      riderProfile: { select: { id: true } },
      driverProfile: { select: { id: true } },
    },
  });

  const userIds = users.map((user) => user.id);
  const riderIds = users.flatMap((user) => (user.riderProfile ? [user.riderProfile.id] : []));
  const driverIds = users.flatMap((user) => (user.driverProfile ? [user.driverProfile.id] : []));

  const trips = await prisma.trip.findMany({
    where: {
      OR: [
        { riderId: { in: riderIds } },
        { driverId: { in: driverIds } },
      ],
    },
    select: { id: true },
  });
  const tripIds = trips.map((trip) => trip.id);

  await prisma.ledgerEntry.deleteMany({
    where: {
      OR: [{ tripId: { in: tripIds } }, { userId: { in: userIds } }],
    },
  });
  await prisma.tripOffer.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.tripEvent.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
  await prisma.vehicle.deleteMany({ where: { driverId: { in: driverIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  if (emails === trackedEmails) {
    trackedEmails.length = 0;
  }
}
