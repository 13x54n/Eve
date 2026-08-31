import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../gateway/src/app.js";
import { prisma } from "@eve/db";
import { hashPassword } from "@eve/shared";
import { verifyAuth0IdToken } from "../services/auth/src/auth0.js";

vi.mock("../services/auth/src/auth0.js", () => ({
  verifyAuth0IdToken: vi.fn(),
}));

const mockedVerify = vi.mocked(verifyAuth0IdToken);

describe("Auth0 token exchange", () => {
  const riderEmail = `auth0-rider-${Date.now()}@example.com`;
  const driverEmail = `auth0-driver-${Date.now()}@example.com`;
  const linkedEmail = `auth0-link-${Date.now()}@example.com`;

  beforeEach(() => {
    mockedVerify.mockReset();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [riderEmail, driverEmail, linkedEmail] } },
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

  it("rejects a rider token on the driver exchange", async () => {
    mockedVerify.mockResolvedValue({
      sub: "auth0|rider-new",
      email: riderEmail,
      emailVerified: true,
      name: "Auth0 Rider",
    });

    await request(app)
      .post("/api/auth/driver/auth0")
      .send({ idToken: "header.payload.signature" })
      .expect(403);
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
