import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "./helpers/test-app.js";
import { prisma } from "@eve/db";
import { hashPassword, setPayoutSenderForTests } from "@eve/shared";
import { registerDriver } from "./helpers/marketplace.js";

const adminEmail = `wallet-admin-${Date.now()}@example.com`;
const adminPassword = "password123";

describe("Driver Privy wallet cash-out", () => {
  let driverToken = "";
  let driverUserId = "";
  let driverProfileId = "";
  let adminToken = "";
  let driverEmail = "";

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        name: "Wallet Admin",
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        role: "ADMIN",
        adminStaffRole: "OWNER",
      },
    });

    const adminLogin = await request(app)
      .post("/api/auth/admin/login")
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    const registered = registerDriver({ name: "Wallet Driver" });
    driverEmail = registered.email;
    const created = await registered.request.expect(201);
    driverToken = created.body.accessToken;
    driverUserId = created.body.user.id;

    await prisma.user.update({
      where: { id: driverUserId },
      data: { ethereumWallet: "0x1111111111111111111111111111111111111111" },
    });

    const profile = await prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });
    driverProfileId = profile!.id;
  });

  afterEach(() => {
    setPayoutSenderForTests(null);
    delete process.env.TREASURY_PRIVATE_KEY;
    delete process.env.CHAIN_RPC_URL;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, driverEmail] } },
    });
  });

  it("returns empty wallet balance and chain config", async () => {
    const response = await request(app)
      .get("/api/driver/wallet")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(response.body.walletBalance).toBe(0);
    expect(response.body.ethereumWallet).toBe(
      "0x1111111111111111111111111111111111111111",
    );
    expect(response.body.chain.chainId).toBe(5042002);
    expect(response.body.chain.chainName).toBe("Arc Testnet");
    expect(response.body.chain.tokenSymbol).toBe("USDC");
    expect(response.body.chain.treasuryConfigured).toBe(false);
  });

  it("rejects cash-out when the Eve wallet is empty", async () => {
    const response = await request(app)
      .post("/api/driver/wallet/withdraw")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ amount: 5 })
      .expect(409);

    expect(response.body.message).toMatch(/Insufficient/i);
  });

  it("credits the driver wallet and leaves cash-out pending without treasury", async () => {
    await request(app)
      .post(`/api/admin/drivers/${driverProfileId}/wallet/credit`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 25, note: "Test bonus" })
      .expect(200);

    const wallet = await request(app)
      .get("/api/driver/wallet")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);
    expect(wallet.body.walletBalance).toBe(25);

    const withdraw = await request(app)
      .post("/api/driver/wallet/withdraw")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ amount: 10, idempotencyKey: "idem-pending-10" })
      .expect(201);

    expect(withdraw.body.entry.status).toBe("PENDING");
    expect(withdraw.body.entry.type).toBe("WALLET_WITHDRAW");
    expect(withdraw.body.walletBalance).toBe(15);
    expect(withdraw.body.entry.providerRef).toBeNull();

    const replay = await request(app)
      .post("/api/driver/wallet/withdraw")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ amount: 10, idempotencyKey: "idem-pending-10" })
      .expect(201);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.walletBalance).toBe(15);
  });

  it("sends on-chain payout when treasury is configured", async () => {
    process.env.TREASURY_PRIVATE_KEY = "0x".padEnd(66, "a");
    process.env.CHAIN_RPC_URL = "http://127.0.0.1:8545";
    setPayoutSenderForTests(async () => ({ txHash: "0xdeadbeef" }));

    await request(app)
      .post(`/api/admin/drivers/${driverProfileId}/wallet/credit`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 8 })
      .expect(200);

    const withdraw = await request(app)
      .post("/api/driver/wallet/withdraw")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ amount: 8, idempotencyKey: "idem-chain-8" })
      .expect(201);

    expect(withdraw.body.entry.status).toBe("COMPLETED");
    expect(withdraw.body.entry.providerRef).toBe("0xdeadbeef");
  });

  it("refunds the ledger if the treasury send fails", async () => {
    process.env.TREASURY_PRIVATE_KEY = "0x".padEnd(66, "b");
    process.env.CHAIN_RPC_URL = "http://127.0.0.1:8545";
    setPayoutSenderForTests(async () => {
      throw new Error("rpc down");
    });

    const before = await request(app)
      .get("/api/driver/wallet")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    await request(app)
      .post(`/api/admin/drivers/${driverProfileId}/wallet/credit`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 4 })
      .expect(200);

    const failed = await request(app)
      .post("/api/driver/wallet/withdraw")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ amount: 4, idempotencyKey: "idem-fail-4" })
      .expect(409);
    expect(failed.body.message).toMatch(/rpc down/i);

    const after = await request(app)
      .get("/api/driver/wallet")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);
    expect(after.body.walletBalance).toBe(before.body.walletBalance + 4);
  });

  it("admin payouts debit walletBalance", async () => {
    await request(app)
      .post(`/api/admin/drivers/${driverProfileId}/wallet/credit`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 6 })
      .expect(200);

    await request(app)
      .post("/api/admin/payouts")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: driverUserId, amount: 6, note: "Manual payout" })
      .expect(201);

    const wallet = await request(app)
      .get("/api/driver/wallet")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);
    expect(
      wallet.body.entries.some(
        (row: { type: string; amount: number }) =>
          row.type === "PAYOUT" && row.amount === 6,
      ),
    ).toBe(true);
  });
});
