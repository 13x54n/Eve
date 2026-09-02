import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import app from "./helpers/test-app.js";
import { prisma } from "@eve/db";
import { hashPassword, verifyAccessToken } from "@eve/shared";
import { verifyAuth0IdToken } from "../services/auth/src/auth0.js";

vi.mock("../services/auth/src/auth0.js", () => ({
  verifyAuth0IdToken: vi.fn(),
}));

const mockedVerify = vi.mocked(verifyAuth0IdToken);

describe("Auth0 token exchange", () => {
  const riderEmail = `auth0-rider-${Date.now()}@example.com`;
  const driverEmail = `auth0-driver-${Date.now()}@example.com`;
  const linkedEmail = `auth0-link-${Date.now()}@example.com`;
  const dualRiderEmail = `auth0-dual-rider-${Date.now()}@example.com`;
  const dualDriverEmail = `auth0-dual-driver-${Date.now()}@example.com`;

  beforeEach(() => {
    mockedVerify.mockReset();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [riderEmail, driverEmail, linkedEmail, dualRiderEmail, dualDriverEmail] } },
    });
  });

  it("creates a rider from a verified Auth0 ID token", async () => {
    mockedVerify.mockResolvedValue({
      sub: "auth0|rider-new",
      email: riderEmail,
      emailVerified: true,
      name: "Auth0 Rider",
    });

    const response = await request(app)
      .post("/api/auth/auth0")
      .send({ idToken: "header.payload.signature" })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      email: riderEmail,
      name: "Auth0 Rider",
      role: "RIDER",
    });
    expect(response.body.user.passwordHash).toBeUndefined();

    const stored = await prisma.user.findUnique({ where: { email: riderEmail } });
    expect(stored?.auth0Sub).toBe("auth0|rider-new");
    expect(stored?.passwordHash).toBeNull();
  });

  it("creates a driver from Auth0 and returns a driver profile", async () => {
    mockedVerify.mockResolvedValue({
      sub: "auth0|driver-new",
      email: driverEmail,
      emailVerified: true,
      name: "Auth0 Driver",
    });

    const response = await request(app)
      .post("/api/auth/driver/auth0")
      .send({ idToken: "header.payload.signature" })
      .expect(200);

    expect(response.body.user).toMatchObject({
      email: driverEmail,
      role: "DRIVER",
      accountStatus: "PENDING",
    });
    expect(response.body.driverProfile).toBeTruthy();
  });

  it("links an existing password rider when the Auth0 email is verified", async () => {
    await prisma.user.create({
      data: {
        name: "Legacy Rider",
        email: linkedEmail,
        passwordHash: await hashPassword("password123"),
        role: "RIDER",
        riderProfile: { create: {} },
      },
    });

    mockedVerify.mockResolvedValue({
      sub: "auth0|legacy-link",
      email: linkedEmail,
      emailVerified: true,
      name: "Legacy Rider",
    });

    const response = await request(app)
      .post("/api/auth/auth0")
      .send({ idToken: "header.payload.signature" })
      .expect(200);

    expect(response.body.user.email).toBe(linkedEmail);
    const stored = await prisma.user.findUnique({ where: { email: linkedEmail } });
    expect(stored?.auth0Sub).toBe("auth0|legacy-link");
  });

  it("lets a rider attach a driver profile on the driver exchange", async () => {
    mockedVerify.mockResolvedValue({
      sub: "auth0|rider-dual",
      email: dualRiderEmail,
      emailVerified: true,
      name: "Auth0 Rider",
    });

    await request(app)
      .post("/api/auth/auth0")
      .send({ idToken: "header.payload.signature" })
      .expect(200);

    mockedVerify.mockResolvedValue({
      sub: "auth0|rider-dual",
      email: dualRiderEmail,
      emailVerified: true,
      name: "Auth0 Rider",
    });

    const driverExchange = await request(app)
      .post("/api/auth/driver/auth0")
      .send({ idToken: "header.payload.signature" })
      .expect(200);

    expect(driverExchange.body.user).toMatchObject({
      email: dualRiderEmail,
      role: "DRIVER",
      accountStatus: "ACTIVE",
    });
    expect(driverExchange.body.driverProfile).toBeTruthy();

    const stored = await prisma.user.findUnique({
      where: { email: dualRiderEmail },
      include: { riderProfile: true, driverProfile: true },
    });
    expect(stored?.role).toBe("RIDER");
    expect(stored?.accountStatus).toBe("ACTIVE");
    expect(stored?.riderProfile).toBeTruthy();
    expect(stored?.driverProfile).toBeTruthy();

    const payload = verifyAccessToken(driverExchange.body.accessToken);
    expect(payload.role).toBe("DRIVER");
    expect(payload.sub).toBe(stored?.id);

    mockedVerify.mockResolvedValue({
      sub: "auth0|rider-dual",
      email: dualRiderEmail,
      emailVerified: true,
      name: "Auth0 Rider",
    });

    const riderExchange = await request(app)
      .post("/api/auth/auth0")
      .send({ idToken: "header.payload.signature" })
      .expect(200);

    expect(riderExchange.body.user.role).toBe("RIDER");
    expect(verifyAccessToken(riderExchange.body.accessToken).role).toBe("RIDER");
  });

  it("lets a driver attach a rider profile on the rider exchange", async () => {
    mockedVerify.mockResolvedValue({
      sub: "auth0|driver-dual",
      email: dualDriverEmail,
      emailVerified: true,
      name: "Auth0 Driver",
    });

    await request(app)
      .post("/api/auth/driver/auth0")
      .send({ idToken: "header.payload.signature" })
      .expect(200);

    mockedVerify.mockResolvedValue({
      sub: "auth0|driver-dual",
      email: dualDriverEmail,
      emailVerified: true,
      name: "Auth0 Driver",
    });

    const riderExchange = await request(app)
      .post("/api/auth/auth0")
      .send({ idToken: "header.payload.signature" })
      .expect(200);

    expect(riderExchange.body.user.role).toBe("RIDER");

    const stored = await prisma.user.findUnique({
      where: { email: dualDriverEmail },
      include: { riderProfile: true, driverProfile: true },
    });
    expect(stored?.role).toBe("DRIVER");
    expect(stored?.riderProfile).toBeTruthy();
    expect(stored?.driverProfile).toBeTruthy();
  });

  it("rejects an invalid Auth0 token", async () => {
    mockedVerify.mockRejectedValue(
      Object.assign(new Error("Invalid Auth0 token"), { name: "UnauthorizedError" }),
    );

    await request(app)
      .post("/api/auth/auth0")
      .send({ idToken: "header.payload.signature" })
      .expect(401);
  });
});
