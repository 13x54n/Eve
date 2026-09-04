import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import app from "./helpers/test-app.js";
import { prisma } from "@eve/db";
import { hashPassword, verifyAccessToken } from "@eve/shared";
import { verifyPrivyIdentityToken } from "../services/auth/src/privy.js";

vi.mock("../services/auth/src/privy.js", () => ({
  verifyPrivyIdentityToken: vi.fn(),
}));

const mockedVerify = vi.mocked(verifyPrivyIdentityToken);

describe("Privy token exchange", () => {
  const riderEmail = `privy-rider-${Date.now()}@example.com`;
  const driverEmail = `privy-driver-${Date.now()}@example.com`;
  const linkedEmail = `privy-link-${Date.now()}@example.com`;
  const dualRiderEmail = `privy-dual-rider-${Date.now()}@example.com`;
  const dualDriverEmail = `privy-dual-driver-${Date.now()}@example.com`;
  const riderPhone = `+1555${Date.now().toString().slice(-7)}`;

  beforeEach(() => {
    mockedVerify.mockReset();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { in: [riderEmail, driverEmail, linkedEmail, dualRiderEmail, dualDriverEmail] } },
          { phone: riderPhone },
        ],
      },
    });
  });

  it("creates a rider from a verified Privy identity token", async () => {
    mockedVerify.mockResolvedValue({
      privyDid: "did:privy:rider-new",
      email: riderEmail,
      phone: riderPhone,
      name: "Privy Rider",
      ethereumWallet: "0x1111111111111111111111111111111111111111",
      solanaWallet: "SoL111111111111111111111111111111111111111",
    });

    const response = await request(app)
      .post("/api/auth/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      email: riderEmail,
      name: "Privy Rider",
      role: "RIDER",
      ethereumWallet: "0x1111111111111111111111111111111111111111",
      solanaWallet: "SoL111111111111111111111111111111111111111",
    });
    expect(response.body.user.passwordHash).toBeUndefined();

    const stored = await prisma.user.findUnique({ where: { email: riderEmail } });
    expect(stored?.privyDid).toBe("did:privy:rider-new");
    expect(stored?.passwordHash).toBeNull();
  });

  it("creates a driver from Privy and returns a driver profile", async () => {
    mockedVerify.mockResolvedValue({
      privyDid: "did:privy:driver-new",
      email: driverEmail,
      name: "Privy Driver",
    });

    const response = await request(app)
      .post("/api/auth/driver/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
      .expect(200);

    expect(response.body.user).toMatchObject({
      email: driverEmail,
      role: "DRIVER",
      accountStatus: "PENDING",
    });
    expect(response.body.driverProfile).toBeTruthy();
  });

  it("links an existing password rider when the Privy email matches", async () => {
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
      privyDid: "did:privy:legacy-link",
      email: linkedEmail,
      name: "Legacy Rider",
    });

    const response = await request(app)
      .post("/api/auth/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
      .expect(200);

    expect(response.body.user.email).toBe(linkedEmail);
    const stored = await prisma.user.findUnique({ where: { email: linkedEmail } });
    expect(stored?.privyDid).toBe("did:privy:legacy-link");
  });

  it("lets a rider attach a driver profile on the driver exchange", async () => {
    mockedVerify.mockResolvedValue({
      privyDid: "did:privy:rider-dual",
      email: dualRiderEmail,
      name: "Privy Rider",
    });

    await request(app)
      .post("/api/auth/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
      .expect(200);

    mockedVerify.mockResolvedValue({
      privyDid: "did:privy:rider-dual",
      email: dualRiderEmail,
      name: "Privy Rider",
    });

    const driverExchange = await request(app)
      .post("/api/auth/driver/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
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
      privyDid: "did:privy:rider-dual",
      email: dualRiderEmail,
      name: "Privy Rider",
    });

    const riderExchange = await request(app)
      .post("/api/auth/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
      .expect(200);

    expect(riderExchange.body.user.role).toBe("RIDER");
    expect(verifyAccessToken(riderExchange.body.accessToken).role).toBe("RIDER");
  });

  it("lets a driver attach a rider profile on the rider exchange", async () => {
    mockedVerify.mockResolvedValue({
      privyDid: "did:privy:driver-dual",
      email: dualDriverEmail,
      name: "Privy Driver",
    });

    await request(app)
      .post("/api/auth/driver/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
      .expect(200);

    mockedVerify.mockResolvedValue({
      privyDid: "did:privy:driver-dual",
      email: dualDriverEmail,
      name: "Privy Driver",
    });

    const riderExchange = await request(app)
      .post("/api/auth/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
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

  it("rejects an invalid Privy token", async () => {
    mockedVerify.mockRejectedValue(
      Object.assign(new Error("Invalid Privy token"), { name: "UnauthorizedError" }),
    );

    await request(app)
      .post("/api/auth/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
      .expect(401);
  });
});
