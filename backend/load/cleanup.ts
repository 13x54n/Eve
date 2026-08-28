import "dotenv/config";
import { prisma } from "@eve/db";

const LOAD_DOMAIN = "eve-load.test";

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${LOAD_DOMAIN}` } },
    select: {
      id: true,
      riderProfile: { select: { id: true } },
      driverProfile: { select: { id: true } },
    },
  });

  const userIds = users.map((user) => user.id);
  const riderIds = users.flatMap((user) => (user.riderProfile ? [user.riderProfile.id] : []));
  const driverIds = users.flatMap((user) => (user.driverProfile ? [user.driverProfile.id] : []));

  const trips = await prisma.trip.findMany({
    where: {
      OR: [{ riderId: { in: riderIds } }, { driverId: { in: driverIds } }],
    },
    select: { id: true },
  });
  const tripIds = trips.map((trip) => trip.id);

  await prisma.ledgerEntry.deleteMany({
    where: { OR: [{ tripId: { in: tripIds } }, { userId: { in: userIds } }] },
  });
  await prisma.tripOffer.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.tripEvent.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
  await prisma.vehicle.deleteMany({ where: { driverId: { in: driverIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  const deleted = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log(`Deleted ${deleted.count} load users (@${LOAD_DOMAIN})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
