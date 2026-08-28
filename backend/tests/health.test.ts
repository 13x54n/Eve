import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../gateway/src/app.js";

describe("Health endpoint", () => {
  it("returns a healthy response", async () => {
    const response = await request(app)
      .get("/api/health")
      .expect(200);

    expect(response.body).toEqual({
      status: "ok",
    });
  });
});