import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "./helpers/test-app.js";

describe("CORS", () => {
  it("allows requests with no Origin header", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body.status).toBe("ok");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("echoes a whitelisted Origin", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:3000")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not allow an unknown Origin", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "https://evil.example")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
