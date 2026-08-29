import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../gateway/src/app.js";

describe("Health endpoint", () => {
  it("returns a healthy response", async () => {
    const response = await request(app)
      .get("/api/health")
      .expect(200);

    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("gateway");
    expect(response.body.memory).toEqual(
      expect.objectContaining({
        rss: expect.any(Number),
        heapUsed: expect.any(Number),
        heapTotal: expect.any(Number),
      }),
    );
    expect(response.body.host).toEqual(
      expect.objectContaining({
        hostname: expect.any(String),
        cpus: expect.any(Number),
        totalMem: expect.any(Number),
        freeMem: expect.any(Number),
      }),
    );
  });
});