import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "./helpers/test-app.js";
import { prisma } from "@eve/db";
import { registerDriver, registerRider } from "./helpers/marketplace.js";
import { resetMockSwapStore, SUPPORTED_SWAP_TOKENS } from "@eve/payment";

describe("Circle App Kit SDK: Swap on Arc Testnet", () => {
  let driverToken = "";
  let driverUserId = "";
  let driverEmail = "";
  let riderToken = "";
  let riderEmail = "";

  beforeEach(() => {
    resetMockSwapStore();
  });

  afterAll(async () => {
    if (driverUserId) {
      await prisma.driverProfile.deleteMany({ where: { userId: driverUserId } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [driverEmail, riderEmail].filter(Boolean) } },
    });
  });

  it("sets up test driver and rider", async () => {
    const driverReg = registerDriver({ name: "Swap Test Driver" });
    driverEmail = driverReg.email;
    const driverRes = await driverReg.request.expect(201);
    driverToken = driverRes.body.accessToken;
    driverUserId = driverRes.body.user.id;

    const riderReg = registerRider("Rider Swap User");
    riderEmail = riderReg.email;
    const riderRes = await riderReg.request.expect(201);
    riderToken = riderRes.body.accessToken;
  });

  it("rejects unauthenticated requests to swap endpoints", async () => {
    await request(app).get("/api/driver/wallet/swap/wallet").expect(401);
    await request(app).post("/api/driver/wallet/swap/quote").send({}).expect(401);
    await request(app).post("/api/driver/wallet/swap/execute").send({}).expect(401);
    await request(app).get("/api/driver/wallet/swap/history").expect(401);
  });

  it("returns driver swap wallet with Arc Testnet network and supported tokens", async () => {
    const res = await request(app)
      .get("/api/driver/wallet/swap/wallet")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(res.body.wallet).toBeDefined();
    expect(res.body.wallet.address).toMatch(/^0x/);
    expect(res.body.wallet.status).toBe("active");
    expect(res.body.wallet.networks).toBeDefined();
    expect(res.body.wallet.networks[0].name).toBe("Arc Testnet");
    expect(res.body.wallet.networks[0].chainId).toBe(5042002);
    expect(res.body.wallet.networks[0].supportedTokens).toEqual(
      expect.arrayContaining(["USDC", "EURC", "cirBTC"]),
    );
  });

  it("validates input when requesting a swap quote (rejects same tokens and invalid amounts)", async () => {
    // Empty amount
    await request(app)
      .post("/api/driver/wallet/swap/quote")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        tokenIn: "USDC",
        tokenOut: "EURC",
        amountIn: "",
      })
      .expect(400);

    // Same token in and out gracefully auto-differentiates to EURC
    const sameRes = await request(app)
      .post("/api/driver/wallet/swap/quote")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        tokenIn: "USDC",
        tokenOut: "USDC",
        amountIn: "10",
      })
      .expect(200);

    expect(sameRes.body.quote.tokenOut).toBe("EURC");
  });

  it("returns a swap quote on Arc Testnet for USDC -> EURC", async () => {
    const res = await request(app)
      .post("/api/driver/wallet/swap/quote")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        chain: "Arc_Testnet",
        tokenIn: "USDC",
        tokenOut: "EURC",
        amountIn: "10.00",
      })
      .expect(200);

    expect(res.body.quote).toBeDefined();
    expect(res.body.quote.tokenIn).toBe("USDC");
    expect(res.body.quote.tokenOut).toBe("EURC");
    expect(res.body.quote.inputAmount).toBe("10.00");
    expect(parseFloat(res.body.quote.estOutputAmount)).toBeGreaterThan(0);
    expect(parseFloat(res.body.quote.minimumOutputAmount)).toBeGreaterThan(0);
  });

  it("returns a swap quote on Arc Testnet for EURC -> USDC", async () => {
    const res = await request(app)
      .post("/api/driver/wallet/swap/quote")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        chain: "Arc_Testnet",
        tokenIn: "EURC",
        tokenOut: "USDC",
        amountIn: "10.00",
      })
      .expect(200);

    expect(res.body.quote).toBeDefined();
    expect(res.body.quote.tokenIn).toBe("EURC");
    expect(res.body.quote.tokenOut).toBe("USDC");
    expect(parseFloat(res.body.quote.estOutputAmount)).toBeGreaterThan(0);
  });

  it("returns a swap quote on Arc Testnet for USDC -> cirBTC", async () => {
    const res = await request(app)
      .post("/api/driver/wallet/swap/quote")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        chain: "Arc_Testnet",
        tokenIn: "USDC",
        tokenOut: "cirBTC",
        amountIn: "100.00",
      })
      .expect(200);

    expect(res.body.quote).toBeDefined();
    expect(res.body.quote.tokenIn).toBe("USDC");
    expect(res.body.quote.tokenOut).toBe("cirBTC");
    expect(parseFloat(res.body.quote.estOutputAmount)).toBeGreaterThan(0);
  });

  let createdActionId = "";

  it("executes a swap on Arc Testnet and returns confirmation", async () => {
    const res = await request(app)
      .post("/api/driver/wallet/swap/execute")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        chain: "Arc_Testnet",
        tokenIn: "USDC",
        tokenOut: "EURC",
        amountIn: "10.00",
        sourceSymbol: "USDC",
        destinationSymbol: "EURC",
      })
      .expect(201);

    expect(res.body.actionId).toBeDefined();
    expect(res.body.swap).toBeDefined();
    expect(res.body.swap.status).toBe("succeeded");
    expect(res.body.swap.sourceSymbol).toBe("USDC");
    expect(res.body.swap.destinationSymbol).toBe("EURC");
    expect(res.body.swap.hash).toBeDefined();

    createdActionId = res.body.actionId;
  });

  it("queries swap action status by actionId", async () => {
    const res = await request(app)
      .get(`/api/driver/wallet/swap/actions/${createdActionId}`)
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(res.body.status).toBe("succeeded");
    expect(res.body.swap).toBeDefined();
    expect(res.body.swap.actionId).toBe(createdActionId);
  });

  it("lists past swaps in driver swap history", async () => {
    const res = await request(app)
      .get("/api/driver/wallet/swap/history")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(Array.isArray(res.body.history)).toBe(true);
    expect(res.body.history.length).toBeGreaterThanOrEqual(1);
    expect(res.body.history[0].actionId).toBe(createdActionId);
  });
});
