import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import app from "../gateway/src/app.js";
import { prisma } from "@eve/db";
import {
  cleanupMarketplaceUsers,
  createAdminToken,
  spawnRider,
} from "./helpers/marketplace.js";

describe("Rider greetings", () => {
  const createdIds: string[] = [];
  let originalSettings: { mode: "PINNED" | "ROTATE"; pinnedGreetingId: string | null } | null =
    null;

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.greeting.deleteMany({ where: { id: { in: createdIds } } });
    }
    if (originalSettings) {
      await prisma.greetingSettings.update({
        where: { id: "default" },
        data: originalSettings,
      });
    }
    await cleanupMarketplaceUsers();
  });

  it("lets admins manage templates and riders fetch the pinned line", async () => {
    const admin = await createAdminToken();
    const rider = await spawnRider();

    const listed = await request(app)
      .get("/api/admin/greetings")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    originalSettings = {
      mode: listed.body.settings.mode,
      pinnedGreetingId: listed.body.settings.pinnedGreetingId,
    };
    expect(listed.body.items.length).toBeGreaterThan(0);

    const created = await request(app)
      .post("/api/admin/greetings")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ template: "Hello, {name}" })
      .expect(201);
    createdIds.push(created.body.id);
    expect(created.body.template).toBe("Hello, {name}");

    await request(app)
      .patch("/api/admin/greetings/settings")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ mode: "PINNED", pinnedGreetingId: created.body.id })
      .expect(200);

    const greeting = await request(app)
      .get("/api/rider/greeting")
      .set("Authorization", `Bearer ${rider.token}`)
      .expect(200);

    expect(greeting.body.template).toBe("Hello, {name}");
  });
});
