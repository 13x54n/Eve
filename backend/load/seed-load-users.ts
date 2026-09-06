import { createHash } from "node:crypto";
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@eve/db";
import { createAccessToken, hashPassword } from "@eve/shared";

const LOAD_DOMAIN = "eve-load.test";
const PICKUP = { lat: 40.7128, lng: -74.006 };
const password = "LoadPass123!";
const count = Number(process.env.LOAD_COUNT ?? 20);

const outPath = join(dirname(fileURLToPath(import.meta.url)), ".tokens.json");

function testEthAddress(seed: string) {
  return `0x${createHash("sha256").update(seed).digest("hex").slice(0, 40)}`;
}

async function main() {
  const passwordHash = await hashPassword(password);
  const pairs: Array<{
    riderEmail: string;
    driverEmail: string;
    riderToken: string;
    driverToken: string;
  }> = [];

  const adminEmail = `load-admin@${LOAD_DOMAIN}`;
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { adminStaffRole: "OWNER", role: "ADMIN" },
    create: {
      name: "Load Admin",
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      adminStaffRole: "OWNER",
    },
  });
  const adminToken = createAccessToken({
    id: admin.id,
    role: "ADMIN",
    adminStaffRole: "OWNER",
  });

  for (let i = 1; i <= count; i += 1) {
    const riderEmail = `load-rider-${i}@${LOAD_DOMAIN}`;
    const driverEmail = `load-driver-${i}@${LOAD_DOMAIN}`;

    const rider = await prisma.user.upsert({
      where: { email: riderEmail },
      update: {},
      create: {
        name: `Load Rider ${i}`,
        email: riderEmail,
        passwordHash,
        role: "RIDER",
        riderProfile: { create: {} },
      },
    });

    const driver = await prisma.user.upsert({
      where: { email: driverEmail },
      update: {
        driverProfile: {
          update: {
            approvalStatus: "APPROVED",
            presence: "ONLINE",
            latitude: PICKUP.lat,
            longitude: PICKUP.lng,
          },
        },
      },
      create: {
        name: `Load Driver ${i}`,
        email: driverEmail,
        passwordHash,
        role: "DRIVER",
        city: "New York",
        driverProfile: {
          create: {
            approvalStatus: "APPROVED",
            presence: "ONLINE",
            city: "New York",
            latitude: PICKUP.lat,
            longitude: PICKUP.lng,
            vehicles: {
              create: {
                make: "Toyota",
                model: "Camry",
                year: 2022,
                color: "Black",
                plateNumber: `LD${String(i).padStart(6, "0")}`,
                vehicleType: "CAR",
                serviceCategory: "standard",
                capacity: 4,
                city: "New York",
              },
            },
          },
        },
      },
    });

    const riderEth = testEthAddress(`load-rider:${rider.id}`);
    const driverEth = testEthAddress(`load-driver:${driver.id}`);
    await prisma.user.update({
      where: { id: rider.id },
      data: { ethereumWallet: riderEth },
    });
    await prisma.user.update({
      where: { id: driver.id },
      data: { ethereumWallet: driverEth },
    });

    pairs.push({
      riderEmail,
      driverEmail,
      riderToken: createAccessToken({ id: rider.id, role: "RIDER" }),
      driverToken: createAccessToken({ id: driver.id, role: "DRIVER" }),
    });
  }

  writeFileSync(
    outPath,
    `${JSON.stringify({ password, adminEmail, adminPassword: password, adminToken, pairs }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Wrote ${pairs.length} load pairs to ${outPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
