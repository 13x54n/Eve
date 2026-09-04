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
  const driverSmsPhone = `+1556${Date.now().toString().slice(-7)}`;
  const riderSmsPhone = `+1557${Date.now().toString().slice(-7)}`;
  const linkedPhone = `+1558${Date.now().toString().slice(-7)}`;

  beforeEach(() => {
    mockedVerify.mockReset();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { in: [riderEmail, driverEmail, linkedEmail, dualRiderEmail, dualDriverEmail] } },
          {
            phone: {
              in: [riderPhone, driverSmsPhone, riderSmsPhone, linkedPhone],
            },
          },
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

  it("accepts a second driver SMS exchange for the same Privy phone", async () => {
    const claims = {
      privyDid: "did:privy:driver-sms",
      phone: driverSmsPhone,
      name: "SMS Driver",
    };
    mockedVerify.mockResolvedValue(claims);

    const first = await request(app)
      .post("/api/auth/driver/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
      .expect(200);

    expect(first.body.user).toMatchObject({
      phone: driverSmsPhone,
      role: "DRIVER",
    });
    expect(first.body.driverProfile).toBeTruthy();

    mockedVerify.mockResolvedValue(claims);

    const second = await request(app)
      .post("/api/auth/driver/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
      .expect(200);

    expect(second.body.user.id).toBe(first.body.user.id);
    expect(second.body.user.role).toBe("DRIVER");
    expect(verifyAccessToken(second.body.accessToken)).toMatchObject({
      sub: first.body.user.id,
      role: "DRIVER",
    });
  });

  it("accepts a second rider SMS exchange for the same Privy phone", async () => {
    const claims = {
      privyDid: "did:privy:rider-sms",
      phone: riderSmsPhone,
      name: "SMS Rider",
    };
    mockedVerify.mockResolvedValue(claims);

    const first = await request(app)
      .post("/api/auth/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
      .expect(200);

    expect(first.body.user.phone).toBe(riderSmsPhone);
    expect(first.body.user.role).toBe("RIDER");

    mockedVerify.mockResolvedValue(claims);

    const second = await request(app)
      .post("/api/auth/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
      .expect(200);

    expect(second.body.user.id).toBe(first.body.user.id);
    expect(second.body.user.role).toBe("RIDER");
    expect(verifyAccessToken(second.body.accessToken).role).toBe("RIDER");
  });

  it("links an existing password driver when the Privy phone matches", async () => {
    await prisma.user.create({
      data: {
        name: "Legacy Phone Driver",
        phone: linkedPhone,
        passwordHash: await hashPassword("password123"),
        role: "DRIVER",
        driverProfile: { create: {} },
      },
    });

    mockedVerify.mockResolvedValue({
      privyDid: "did:privy:phone-link",
      phone: linkedPhone,
      name: "Legacy Phone Driver",
    });

    const response = await request(app)
      .post("/api/auth/driver/privy")
      .send({ identityToken: "header.payload.signaturexxxx" })
      .expect(200);

    expect(response.body.user.phone).toBe(linkedPhone);
    expect(response.body.user.role).toBe("DRIVER");
    const stored = await prisma.user.findUnique({ where: { phone: linkedPhone } });
    expect(stored?.privyDid).toBe("did:privy:phone-link");
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
