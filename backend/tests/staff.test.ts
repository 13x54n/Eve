import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import app from "./helpers/test-app.js";
import { prisma } from "@eve/db";
import { createAccessToken, hashPassword } from "@eve/shared";
import {
  TEST_PASSWORD,
  cleanupMarketplaceUsers,
  createAdminToken,
  spawnRider,
  uniqueEmail,
} from "./helpers/marketplace.js";

async function createStaffUser(input: {
  name: string;
  role: "OWNER" | "OPERATIONS" | "FINANCE" | "SUPPORT" | "SAFETY";
  title?: "MANAGER" | "MEMBER" | null;
  password?: string;
}) {
  const email = uniqueEmail("admin");
  const password = input.password ?? TEST_PASSWORD;
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      adminStaffRole: input.role,
      adminStaffTitle: input.role === "OWNER" ? null : (input.title ?? null),
    },
  });

  return {
    email,
    id: user.id,
    password,
    token: createAccessToken({
      id: user.id,
      role: "ADMIN",
      adminStaffRole: input.role,
    }),
  };
}

describe("Admin staff provisioning", () => {
  afterAll(async () => {
    await cleanupMarketplaceUsers();
  });

  it("lets an owner create a department manager who can log in", async () => {
    const owner = await createAdminToken();
    const email = uniqueEmail("admin");
    const password = "Manager123!";

    const created = await request(app)
      .post("/api/admin/staff")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        name: "Ops Hire",
        email,
        password,
        adminStaffRole: "OPERATIONS",
      })
      .expect(201);

    expect(created.body).toMatchObject({
      email,
      role: "ADMIN",
      adminStaffRole: "OPERATIONS",
      adminStaffTitle: "MANAGER",
    });
    expect(created.body.passwordHash).toBeUndefined();

    const login = await request(app)
      .post("/api/auth/admin/login")
      .send({ email, password })
      .expect(200);

    expect(login.body.user).toMatchObject({
      email,
      adminStaffRole: "OPERATIONS",
      adminStaffTitle: "MANAGER",
    });
    expect(login.body.accessToken).toEqual(expect.any(String));
  });

  it("lets a manager create a department member who can log in", async () => {
    const manager = await createStaffUser({
      name: "Ops Manager",
      role: "OPERATIONS",
      title: "MANAGER",
    });
    const email = uniqueEmail("admin");
    const password = "Member123!";

    const created = await request(app)
      .post("/api/admin/staff")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        name: "Ops Member",
        email,
        password,
      })
      .expect(201);

    expect(created.body).toMatchObject({
      email,
      adminStaffRole: "OPERATIONS",
      adminStaffTitle: "MEMBER",
    });

    const login = await request(app)
      .post("/api/auth/admin/login")
      .send({ email, password })
      .expect(200);

    expect(login.body.user).toMatchObject({
      email,
      adminStaffRole: "OPERATIONS",
      adminStaffTitle: "MEMBER",
    });
  });

  it("blocks a manager from creating finance staff or another manager", async () => {
    const manager = await createStaffUser({
      name: "Ops Manager",
      role: "OPERATIONS",
      title: "MANAGER",
    });

    await request(app)
      .post("/api/admin/staff")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        name: "Finance Hire",
        email: uniqueEmail("admin"),
        password: "Manager123!",
        adminStaffRole: "FINANCE",
      })
      .expect(403);

    await request(app)
      .post("/api/admin/staff")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        name: "Ops Peer",
        email: uniqueEmail("admin"),
        password: "Manager123!",
        adminStaffTitle: "MANAGER",
        adminStaffRole: "OPERATIONS",
      })
      .expect(403);
  });

  it("blocks an owner from creating a member directly", async () => {
    const owner = await createAdminToken();

    await request(app)
      .post("/api/admin/staff")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        name: "Ops Member",
        email: uniqueEmail("admin"),
        password: "Member123!",
        adminStaffRole: "OPERATIONS",
        adminStaffTitle: "MEMBER",
      })
      .expect(403);
  });

  it("rejects members and non-admins on staff create", async () => {
    const member = await createStaffUser({
      name: "Support Member",
      role: "SUPPORT",
      title: "MEMBER",
    });
    const rider = await spawnRider();

    await request(app)
      .post("/api/admin/staff")
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        name: "Support Hire",
        email: uniqueEmail("admin"),
        password: "Member123!",
      })
      .expect(403);

    await request(app)
      .post("/api/admin/staff")
      .set("Authorization", `Bearer ${rider.token}`)
      .send({
        name: "Support Hire",
        email: uniqueEmail("admin"),
        password: "Member123!",
      })
      .expect(403);
  });

  it("scopes the staff directory and credential resets", async () => {
    const owner = await createAdminToken();
    const opsManager = await createStaffUser({
      name: "Ops Manager",
      role: "OPERATIONS",
      title: "MANAGER",
    });
    const financeManager = await createStaffUser({
      name: "Finance Manager",
      role: "FINANCE",
      title: "MANAGER",
    });
    const opsMember = await createStaffUser({
      name: "Ops Member",
      role: "OPERATIONS",
      title: "MEMBER",
    });

    const ownerList = await request(app)
      .get("/api/admin/staff")
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);

    expect(ownerList.body.map((row: { id: string }) => row.id)).toEqual(
      expect.arrayContaining([opsManager.id, financeManager.id, opsMember.id, owner.id]),
    );

    const managerList = await request(app)
      .get("/api/admin/staff")
      .set("Authorization", `Bearer ${opsManager.token}`)
      .expect(200);

    expect(managerList.body.every((row: { adminStaffRole: string }) => row.adminStaffRole === "OPERATIONS")).toBe(
      true,
    );
    expect(managerList.body.map((row: { id: string }) => row.id)).toEqual(
      expect.arrayContaining([opsManager.id, opsMember.id]),
    );
    expect(managerList.body.map((row: { id: string }) => row.id)).not.toContain(financeManager.id);

    const newPassword = "ResetPass123!";
    await request(app)
      .post(`/api/admin/staff/${opsMember.id}/credentials`)
      .set("Authorization", `Bearer ${opsManager.token}`)
      .send({ password: newPassword })
      .expect(200);

    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: opsMember.email, password: newPassword })
      .expect(200);

    await request(app)
      .post(`/api/admin/staff/${financeManager.id}/credentials`)
      .set("Authorization", `Bearer ${opsManager.token}`)
      .send({ password: "NoAccess123!" })
      .expect(403);

    await request(app)
      .get("/api/admin/staff")
      .set("Authorization", `Bearer ${opsMember.token}`)
      .expect(403);
  });
});
