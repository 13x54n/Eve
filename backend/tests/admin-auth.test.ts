import request from "supertest";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import app from "../gateway/src/app.js";
import { prisma } from "@eve/db";
import { hashPassword } from "@eve/shared";

const adminEmail = `admin-${Date.now()}@example.com`;
const riderEmail = `rider-admin-${Date.now()}@example.com`;
const password = "password123";

describe("Admin authentication", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        name: "Test Owner",
        email: adminEmail,
        passwordHash: await hashPassword(password),
        role: "ADMIN",
        adminStaffRole: "OWNER",
      },
    });

    await prisma.user.create({
      data: {
        name: "Not Admin",
        email: riderEmail,
        passwordHash: await hashPassword(password),
        role: "RIDER",
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, riderEmail] } },
    });
  });

  it("logs an admin into the console", async () => {
    const response = await request(app)
      .post("/api/auth/admin/login")
      .send({ email: adminEmail, password })
      .expect(200);

    expect(response.body.user).toMatchObject({
      email: adminEmail,
      role: "ADMIN",
      adminStaffRole: "OWNER",
    });
    expect(response.body.user.permissions).toEqual(
      expect.arrayContaining(["dashboard:read", "admin:manage"]),
    );

    const dashboard = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${response.body.accessToken}`)
      .expect(200);

    expect(dashboard.body.totals).toBeDefined();
  });

  it("rejects a rider from the admin login", async () => {
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: riderEmail, password })
      .expect(401);
  });
});
