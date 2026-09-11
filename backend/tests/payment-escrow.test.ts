import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createHash } from "node:crypto";
import app from "./helpers/test-app.js";
import { prisma } from "@eve/db";
import {
  advanceEscrowNowMs,
  clearEscrowTimers,
  DISPUTE_WINDOW_MS,
  setEscrowNowMs,
} from "@eve/payment";
import {
  cleanupMarketplaceUsers,
  confirmEscrow,
  nycTripPayload,
  spawnApprovedOnlineDriver,
  spawnRider,
} from "./helpers/marketplace.js";

describe("Arc USDC escrow", { timeout: 20000 }, () => {
  beforeEach(() => {
    setEscrowNowMs(null);
    clearEscrowTimers();
  });
  afterAll(async () => {
    setEscrowNowMs(null);
    clearEscrowTimers();
    await cleanupMarketplaceUsers();
    await prisma.$disconnect();
  });

  async function fundCompletedTrip() {
    const rider = await spawnRider();
    const driver = await spawnApprovedOnlineDriver();
    const created = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${rider.token}`)
      .send(nycTripPayload())
      .expect(201);
    const trip = created.body.trip;
    const offer = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ proposedFare: trip.fareTotal, etaMinutes: 5 })
      .expect(201);
    await request(app)
      .post(`/api/rider/trips/${trip.id}/offers/${offer.body.offer.id}/accept`)
      .set("Authorization", `Bearer ${rider.token}`)
      .expect(200);
    await confirmEscrow(rider.token, trip.id, "deposit").expect(200);
    await request(app)
      .post(`/api/driver/trips/${trip.id}/arrived`)
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(200);
    await request(app)
      .post(`/api/driver/trips/${trip.id}/start`)
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(200);
    await request(app)
      .post(`/api/driver/trips/${trip.id}/complete`)
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(200);
    return { rider, driver, trip };
  }

  it("locks fare on confirm, refunds on rider cancel, and exposes rider wallet", async () => {
    const rider = await spawnRider();
    const driver = await spawnApprovedOnlineDriver();
    const created = await request(app)
      .post("/api/rider/trips")
      .set("Authorization", `Bearer ${rider.token}`)
      .send(nycTripPayload())
      .expect(201);
    const trip = created.body.trip;
    expect(trip.paymentMethod).toBe("WALLET");

    const offer = await request(app)
      .post(`/api/driver/trips/${trip.id}/offers`)
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ proposedFare: trip.fareTotal, etaMinutes: 5 })
      .expect(201);

    const accepted = await request(app)
      .post(`/api/rider/trips/${trip.id}/offers/${offer.body.offer.id}/accept`)
      .set("Authorization", `Bearer ${rider.token}`)
      .expect(200);
    expect(accepted.body.deposit.value).toMatch(/^0x/i);
    expect(accepted.body.deposit.decimals).toBe(18);

    const funded = await confirmEscrow(rider.token, trip.id).expect(200);
    expect(funded.body.paymentStatus).toBe("ESCROWED");

    const wallet = await request(app)
      .get("/api/rider/wallet")
      .set("Authorization", `Bearer ${rider.token}`)
      .expect(200);
    expect(wallet.body.ethereumWallet).toMatch(/^0x/i);
    expect(wallet.body.chain.chainId).toBe(5042002);
    expect(wallet.body.chain.tokenAddress).toBe(
      "0x3600000000000000000000000000000000000000",
    );
    expect(wallet.body.chain.tokenDecimals).toBe(6);

    await request(app)
      .post(`/api/rider/trips/${trip.id}/cancel`)
      .set("Authorization", `Bearer ${rider.token}`)
      .expect(200);

    await confirmEscrow(rider.token, trip.id, "refund").expect(200);

    const cancelled = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(cancelled?.paymentStatus).toBe("CANCELLED");
    expect(cancelled?.escrowRefundTx).toBeTruthy();
  });

  it("starts settlement, blocks early finalize, then auto-releases after 5 minutes", async () => {
    const { rider: _rider, driver, trip } = await fundCompletedTrip();
    await confirmEscrow(driver.token, trip.id, "startSettlement").expect(200);
    await confirmEscrow(driver.token, trip.id, "finalize").expect(409);

    await advanceEscrowNowMs(DISPUTE_WINDOW_MS);
    const row = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(row?.paymentStatus).toBe("COMPLETED");
    expect(row?.escrowReleaseTx).toBeTruthy();
  });

  it("holds a disputed fare until review and refunds when the trip had a route deviation", async () => {
    const { rider, driver, trip } = await fundCompletedTrip();
    await confirmEscrow(driver.token, trip.id, "startSettlement").expect(200);
    await prisma.trip.update({ where: { id: trip.id }, data: { routeDeviation: true } });

    const disputed = await confirmEscrow(rider.token, trip.id, "dispute").expect(200);
    expect(["DISPUTED", "CANCELLED"]).toContain(disputed.body.paymentStatus);
    await confirmEscrow(rider.token, trip.id, "refund").expect(409);

    await advanceEscrowNowMs(DISPUTE_WINDOW_MS);
    const row = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(row?.paymentStatus).toBe("CANCELLED");
    expect(row?.escrowDisputeTx).toBeTruthy();
    expect(row?.escrowRefundTx).toBeTruthy();
    expect(row?.escrowReleaseTx).toBeFalsy();

    const ticket = await prisma.supportTicket.findFirst({
      where: { tripId: trip.id, category: "escrow_dispute" },
    });
    expect(ticket).toBeTruthy();
  });

  it("releases a clean dispute to the driver after admin AI review", async () => {
    const { rider, driver, trip } = await fundCompletedTrip();
    await confirmEscrow(driver.token, trip.id, "startSettlement").expect(200);
    await confirmEscrow(rider.token, trip.id, "dispute").expect(200);
    const row = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(row?.paymentStatus).toBe("COMPLETED");
    expect(row?.escrowReleaseTx).toBeTruthy();
  });

  it("rejects invalid deposit hashes", async () => {
    const rider = await spawnRider();
    await request(app)
      .post(`/api/payment/trips/${createHash("sha256").update("missing").digest("hex").slice(0, 24)}/confirm`)
      .set("Authorization", `Bearer ${rider.token}`)
      .send({ txHash: "0x" + "ab".repeat(32) })
      .expect(404);
  });
});
