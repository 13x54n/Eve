import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "./helpers/test-app.js";
import { prisma } from "@eve/db";
import { registerDriver, registerRider } from "./helpers/marketplace.js";
import { resetMockFiatStore, setMockPayoutStatus } from "@eve/payment";

describe("Driver Privy Fiat Payouts", () => {
  let driverToken = "";
  let driverUserId = "";
  let driverEmail = "";
  let riderToken = "";
  let riderEmail = "";

  beforeEach(async () => {
    resetMockFiatStore();
  });

  afterAll(async () => {
    if (driverUserId) {
      await prisma.ledgerEntry.deleteMany({ where: { userId: driverUserId } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [driverEmail, riderEmail].filter(Boolean) } },
    });
  });

  it("sets up test driver and rider", async () => {
    const driverReg = registerDriver({ name: "Privy Fiat Driver" });
    driverEmail = driverReg.email;
    const driverRes = await driverReg.request.expect(201);
    driverToken = driverRes.body.accessToken;
    driverUserId = driverRes.body.user.id;

    // Attach privyDid and ethereumWalletId
    await prisma.user.update({
      where: { id: driverUserId },
      data: {
        privyDid: `did:privy:${driverUserId}`,
        ethereumWallet: "0x2222222222222222222222222222222222222222",
        ethereumWalletId: `wallet_${driverUserId}`,
      },
    });

    const riderReg = registerRider("Privy Rider");
    riderEmail = riderReg.email;
    const riderRes = await riderReg.request.expect(201);
    riderToken = riderRes.body.accessToken;
  });

  it("rejects unauthenticated requests", async () => {
    await request(app).get("/api/driver/wallet/bank-accounts").expect(401);
    await request(app).post("/api/driver/wallet/bank-accounts").send({}).expect(401);
    await request(app).post("/api/driver/wallet/payout").send({}).expect(401);
  });

  it("rejects rider access to driver bank account endpoints", async () => {
    await request(app)
      .get("/api/driver/wallet/bank-accounts")
      .set("Authorization", `Bearer ${riderToken}`)
      .expect(403);
  });

  it("returns empty bank account list initially", async () => {
    const res = await request(app)
      .get("/api/driver/wallet/bank-accounts")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(res.body.accounts).toEqual([]);
  });

  it("validates input when registering bank account", async () => {
    const badInput = {
      accountOwnerName: "Driver Name",
      routingNumber: "123", // invalid length
      accountNumber: "456", // too short
      address: {
        streetLine1: "123 Main St",
        city: "San Francisco",
        state: "CALIFORNIA", // must be 2-letter state code
        postalCode: "94105",
      },
    };

    const res = await request(app)
      .post("/api/driver/wallet/bank-accounts")
      .set("Authorization", `Bearer ${driverToken}`)
      .send(badInput)
      .expect(400);

    expect(res.body.message).toBeDefined();
  });

  let createdAccountId = "";

  it("registers a US bank account successfully", async () => {
    const input = {
      accountOwnerName: "Alice Driver",
      bankName: "Chase Bank",
      routingNumber: "021000021",
      accountNumber: "123456789012",
      checkingOrSavings: "checking",
      address: {
        streetLine1: "100 Market St",
        city: "San Francisco",
        state: "CA",
        postalCode: "94105",
      },
    };

    const res = await request(app)
      .post("/api/driver/wallet/bank-accounts")
      .set("Authorization", `Bearer ${driverToken}`)
      .send(input)
      .expect(201);

    expect(res.body.external_fiat_account).toBeDefined();
    const acc = res.body.external_fiat_account;
    expect(acc.id).toBeDefined();
    expect(acc.last_4).toBe("9012");
    expect(acc.account_owner_name).toBe("Alice Driver");
    expect(acc.bank_name).toBe("Chase Bank");
    expect(acc.currency).toBe("usd");
    createdAccountId = acc.id;
  });

  it("lists the registered bank account for the driver", async () => {
    const res = await request(app)
      .get("/api/driver/wallet/bank-accounts")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(res.body.accounts).toHaveLength(1);
    expect(res.body.accounts[0].id).toBe(createdAccountId);
    expect(res.body.accounts[0].last_4).toBe("9012");
  });

  let createdActionId = "";

  it("validates payout parameters", async () => {
    // Amount too small
    await request(app)
      .post("/api/driver/wallet/payout")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ amount: 0.5, fiatAccountId: createdAccountId })
      .expect(400);

    // Missing fiatAccountId
    await request(app)
      .post("/api/driver/wallet/payout")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ amount: 25.0 })
      .expect(400);

    // Non-existent fiatAccountId
    await request(app)
      .post("/api/driver/wallet/payout")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ amount: 25.0, fiatAccountId: "non-existent-acc" })
      .expect(404);
  });

  it("executes a fiat payout and records a pending ledger entry", async () => {
    const res = await request(app)
      .post("/api/driver/wallet/payout")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        amount: 50.0,
        fiatAccountId: createdAccountId,
        idempotencyKey: "test-idem-key-1",
      })
      .expect(200);

    expect(res.body.payout).toBeDefined();
    expect(res.body.payout.id).toBeDefined();
    expect(res.body.payout.status).toBe("pending");
    expect(res.body.payout.amount).toBe("50.00");
    expect(res.body.replayed).toBe(false);

    createdActionId = res.body.payout.id;

    // Check DB ledger entry
    const entry = await prisma.ledgerEntry.findFirst({
      where: { providerRef: createdActionId },
    });
    expect(entry).toBeDefined();
    expect(entry?.userId).toBe(driverUserId);
    expect(entry?.entryType).toBe("DEBIT");
    expect(entry?.category).toBe("PAYOUT");
    expect(entry?.amount).toBe(-50.0);
    expect(entry?.status).toBe("PENDING");
  });

  it("replays the same payout when submitting with identical idempotencyKey", async () => {
    const res = await request(app)
      .post("/api/driver/wallet/payout")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        amount: 50.0,
        fiatAccountId: createdAccountId,
        idempotencyKey: "test-idem-key-1",
      })
      .expect(200);

    expect(res.body.replayed).toBe(true);
    expect(res.body.payout.id).toBe(createdActionId);

    // Ensure only 1 ledger entry exists for this idempotency key
    const count = await prisma.ledgerEntry.count({
      where: { idempotencyKey: "payout:test-idem-key-1" },
    });
    expect(count).toBe(1);
  });

  it("retrieves payout status and syncs completed state to local ledger", async () => {
    // Before status change: pending
    const initial = await request(app)
      .get(`/api/driver/wallet/payout/${createdActionId}`)
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(initial.body.payout.status).toBe("pending");
    expect(initial.body.entry.status).toBe("PENDING");

    // Simulate Privy finishing settlement
    setMockPayoutStatus(createdActionId, "succeeded");

    const synced = await request(app)
      .get(`/api/driver/wallet/payout/${createdActionId}`)
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(synced.body.payout.status).toBe("succeeded");
    expect(synced.body.entry.status).toBe("COMPLETED");

    // Verify DB
    const dbEntry = await prisma.ledgerEntry.findFirst({
      where: { providerRef: createdActionId },
    });
    expect(dbEntry?.status).toBe("COMPLETED");
  });

  it("processes Privy webhooks to update payout status", async () => {
    // Create a 2nd payout to test webhook
    const payoutRes = await request(app)
      .post("/api/driver/wallet/payout")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        amount: 30.0,
        fiatAccountId: createdAccountId,
        idempotencyKey: "webhook-test-idem-1",
      })
      .expect(200);

    const webhookActionId = payoutRes.body.payout.id;

    // Send webhook for failure
    await request(app)
      .post("/internal/webhooks/privy")
      .send({
        type: "wallet_action.payout.failed",
        data: {
          id: webhookActionId,
          status: "failed",
          failure_reason: "Bank account closed",
        },
      })
      .expect(200);

    const updated = await prisma.ledgerEntry.findFirst({
      where: { providerRef: webhookActionId },
    });
    expect(updated?.status).toBe("FAILED");
  });

  it("deletes bank account", async () => {
    const res = await request(app)
      .delete(`/api/driver/wallet/bank-accounts/${createdAccountId}`)
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);

    const listRes = await request(app)
      .get("/api/driver/wallet/bank-accounts")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(listRes.body.accounts).toEqual([]);
  });
});

