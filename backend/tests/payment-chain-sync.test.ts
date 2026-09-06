import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { keccak256, toBytes } from "viem";
import app from "./helpers/test-app.js";
import { prisma } from "@eve/db";
import {
  applyChainDeposit,
  applyChainSettlement,
  findTripIdByHash,
  handlePaymentEvent,
} from "@eve/payment";
import {
  cleanupMarketplaceUsers,
  nycTripPayload,
  spawnApprovedOnlineDriver,
  spawnRider,
} from "./helpers/marketplace.js";

function chainTxHash(label: string) {
  return `0x${createHash("sha256").update(label).digest("hex")}`;
}

async function acceptUnfundedTrip() {
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
  return { rider, driver, trip };
}

describe("payment chain/Kafka sync", { timeout: 20000 }, () => {
  beforeEach(async () => {
    await cleanupMarketplaceUsers();
  });
  afterAll(async () => {
    await cleanupMarketplaceUsers();
    await prisma.$disconnect();
  });

  it("returns 409 on driver start while deposit is still PENDING", async () => {
    const { driver, trip } = await acceptUnfundedTrip();
    const started = await request(app)
      .post(`/api/driver/trips/${trip.id}/start`)
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(409);
    expect(started.body.message).toMatch(/lock USDC in escrow/i);
    const row = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(row?.paymentStatus).toBe("PENDING");
  });

  it("marks ESCROWED from a Kafka deposit event so start can proceed", async () => {
    const { rider, driver, trip } = await acceptUnfundedTrip();
    const txHash = chainTxHash(`deposit:${trip.id}`);
    await handlePaymentEvent({
      type: "escrow.deposit.confirmed",
      source: "escrow-watch",
      instance: "other-payment:1:host",
      key: trip.id,
      occurredAt: new Date().toISOString(),
      payload: { txHash },
    });

    const row = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(row?.paymentStatus).toBe("ESCROWED");
    expect(row?.escrowDepositTx).toBe(txHash);

    const ledger = await prisma.ledgerEntry.findFirst({
      where: { tripId: trip.id, type: "CHARGE" },
    });
    expect(ledger).toMatchObject({ status: "PENDING", userId: rider.user.id });

    await request(app)
      .post(`/api/driver/trips/${trip.id}/arrived`)
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(200);
    const started = await request(app)
      .post(`/api/driver/trips/${trip.id}/start`)
      .set("Authorization", `Bearer ${driver.token}`)
      .expect(200);
    expect(started.body.trip.status).toBe("ONGOING");
  });

  it("resolves PENDING assigned trips by on-chain trip id hash", async () => {
    const { trip } = await acceptUnfundedTrip();
    const hash = keccak256(toBytes(trip.id));
    await expect(findTripIdByHash(hash)).resolves.toBe(trip.id);
  });

  it("applies settlement from Kafka without an HTTP confirm", async () => {
    const { rider, driver, trip } = await acceptUnfundedTrip();
    await applyChainDeposit(trip.id, chainTxHash(`deposit:${trip.id}`));
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

    const startTx = chainTxHash(`start:${trip.id}`);
    const settleFromMs = Date.now() + 5 * 60 * 1000;
    await handlePaymentEvent({
      type: "escrow.settlement.started",
      source: "escrow-watch",
      instance: "other-payment:1:host",
      key: trip.id,
      occurredAt: new Date().toISOString(),
      payload: { txHash: startTx, settleFromMs },
    });

    const row = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(row?.paymentStatus).toBe("SETTLING");
    expect(row?.escrowStartTx).toBe(startTx);
    expect(row?.escrowSettleFrom?.getTime()).toBe(settleFromMs);
    expect(rider.token).toBeTruthy();
  });

  it("treats HTTP confirm after chain apply as idempotent", async () => {
    const { rider, trip } = await acceptUnfundedTrip();
    const txHash = chainTxHash(`deposit-idempotent:${trip.id}`);
    await applyChainDeposit(trip.id, txHash);
    const confirmed = await request(app)
      .post(`/api/payment/trips/${trip.id}/confirm`)
      .set("Authorization", `Bearer ${rider.token}`)
      .send({ txHash, action: "deposit" })
      .expect(200);
    expect(confirmed.body.paymentStatus).toBe("ESCROWED");
    expect(confirmed.body.escrowDepositTx).toBe(txHash);
    const charges = await prisma.ledgerEntry.count({
      where: { tripId: trip.id, type: "CHARGE" },
    });
    expect(charges).toBe(1);
  });
});
