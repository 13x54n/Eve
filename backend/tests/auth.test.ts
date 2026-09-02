import request from "supertest";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import app from "./helpers/test-app.js";
import { prisma } from "@eve/db";

const testEmail = `rider-${Date.now()}@example.com`;
const testPassword = "password123";

let accessToken = "";

describe("Authentication API", () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: testEmail,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: testEmail,
      },
    });

    await prisma.$disconnect();
  });

  it("registers a rider", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test Rider",
        email: testEmail,
        password: testPassword,
      })
      .expect(201);

    expect(response.body.accessToken).toEqual(
      expect.any(String),
    );

    expect(response.body.user).toMatchObject({
      name: "Test Rider",
      email: testEmail,
      role: "RIDER",
      isActive: true,
    });

    expect(response.body.user.passwordHash).toBeUndefined();

    accessToken = response.body.accessToken;
  });

  it("does not register the same email twice", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Duplicate Rider",
        email: testEmail,
        password: testPassword,
      })
      .expect(409);

    expect(response.body.message).toBe(
      "Unable to create account with these details",
    );
  });

  it("logs in with valid credentials", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(200);

    expect(response.body.accessToken).toEqual(
      expect.any(String),
    );

    expect(response.body.user).toMatchObject({
      email: testEmail,
      role: "RIDER",
    });

    accessToken = response.body.accessToken;
  });

  it("rejects an incorrect password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testEmail,
        password: "incorrect-password",
      })
      .expect(401);

    expect(response.body).toEqual({
      message: "Invalid email or password",
    });
  });

  it("rejects an unknown email", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "unknown@example.com",
        password: testPassword,
      })
      .expect(401);

    expect(response.body).toEqual({
      message: "Invalid email or password",
    });
  });

  it("returns the current rider with a valid token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.user).toMatchObject({
      email: testEmail,
      role: "RIDER",
    });
    expect(response.body.user.pushNotificationsEnabled).toBe(true);
  });

  it("updates rider name, email, and phone", async () => {
    const updatedEmail = `rider-updated-${Date.now()}@example.com`;
    const response = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Updated Rider",
        email: updatedEmail,
        phone: "+15551234567",
      })
      .expect(200);

    expect(response.body.user).toMatchObject({
      name: "Updated Rider",
      email: updatedEmail,
      phone: "+15551234567",
      role: "RIDER",
    });

    await prisma.user.update({
      where: { email: updatedEmail },
      data: { email: testEmail },
    });
  });

  it("changes password while authenticated", async () => {
    await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: testPassword, newPassword: "newpassword123" })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: testPassword })
      .expect(401);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: "newpassword123" })
      .expect(200);
    accessToken = login.body.accessToken;
  });

  it("toggles push notification preference", async () => {
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const response = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: me.body.user.name,
        email: me.body.user.email,
        phone: me.body.user.phone,
        pushNotificationsEnabled: false,
      })
      .expect(200);

    expect(response.body.user.pushNotificationsEnabled).toBe(false);
  });

  it("rejects /me without an authorization header", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .expect(401);

    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  it("rejects /me with an invalid token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token")
      .expect(401);

    expect(response.body).toEqual({
      message: "Invalid or expired token",
    });
  });
});

it("rejects invalid registration data", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: "A",
      email: "invalid-email",
      password: "123",
    })
    .expect(400);

  expect(response.body.message).toBe("Invalid request data");
  expect(response.body.errors).toBeDefined();
});

it("normalizes the registration email", async () => {
  const email = `Rider-${Date.now()}@Example.COM`;

  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Normalized Rider",
      email,
      password: testPassword,
    })
    .expect(201);

  expect(response.body.user.email).toBe(
    email.toLowerCase(),
  );

  await prisma.user.delete({
    where: {
      email: email.toLowerCase(),
    },
  });
});

it("resets a password with the development verification code", async () => {
  const email = `reset-${Date.now()}@example.com`;

  await request(app)
    .post("/api/auth/register")
    .send({
      name: "Reset Rider",
      email,
      password: testPassword,
    })
    .expect(201);

  const resetRequest = await request(app)
    .post("/api/auth/forgot-password")
    .send({ email })
    .expect(200);

  expect(resetRequest.body.verificationCode).toMatch(/^\d{6}$/);

  await request(app)
    .post("/api/auth/reset-password")
    .send({
      email,
      code: resetRequest.body.verificationCode,
      password: "new-password123",
    })
    .expect(200);

  await request(app)
    .post("/api/auth/login")
    .send({ email, password: "new-password123" })
    .expect(200);

  await prisma.user.delete({ where: { email } });
});