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
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));

    const dashboard = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${response.body.accessToken}`)
      .expect(200);

    expect(dashboard.body.totals).toBeDefined();
  });

  it("refreshes an admin session and rejects the previous refresh token", async () => {
    const login = await request(app)
      .post("/api/auth/admin/login")
      .send({ email: adminEmail, password })
      .expect(200);

    const refreshed = await request(app)
      .post("/api/auth/admin/refresh")
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);

    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.refreshToken).toEqual(expect.any(String));
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);
    expect(refreshed.body.user).toMatchObject({
      email: adminEmail,
      role: "ADMIN",
    });

    await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${refreshed.body.accessToken}`)
      .expect(200);

    await request(app)
      .post("/api/auth/admin/refresh")
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  it("rejects an unknown refresh token", async () => {
    await request(app)
      .post("/api/auth/admin/refresh")
      .send({ refreshToken: "a".repeat(64) })
      .expect(401);
  });

  it("rejects an expired admin refresh token", async () => {
    const login = await request(app)
      .post("/api/auth/admin/login")
      .send({ email: adminEmail, password })
      .expect(200);

    await prisma.adminSession.updateMany({
      where: {
        user: { email: adminEmail },
        revokedAt: null,
      },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app)
      .post("/api/auth/admin/refresh")
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  it("revokes the refresh token on logout", async () => {
    const login = await request(app)
      .post("/api/auth/admin/login")
      .send({ email: adminEmail, password })
      .expect(200);

    await request(app)
      .post("/api/auth/admin/logout")
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);

    await request(app)
      .post("/api/auth/admin/refresh")
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  it("rejects a rider from the admin login", async () => {
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: riderEmail, password })
      .expect(401);
  });
});
