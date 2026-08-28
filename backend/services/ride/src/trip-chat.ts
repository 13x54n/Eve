import { prisma } from "@eve/db";
import { fail } from "@eve/shared";
import { emitTripEvent } from "@eve/notify";

const LIVE_STATUSES = ["ASSIGNED", "ONGOING"] as const;

function serializeMessage(row: {
  id: string;
  tripId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; role: string };
}) {
  return {
    id: row.id,
    tripId: row.tripId,
    authorId: row.authorId,
    body: row.body,
    createdAt: row.createdAt,
    authorName: row.author.name,
    authorRole: row.author.role,
  };
}

async function assertLiveTripAccess(userId: string, tripId: string, role: "RIDER" | "DRIVER") {
  const trip = await prisma.trip.findFirst({
    where:
      role === "RIDER"
        ? { id: tripId, rider: { userId } }
        : { id: tripId, driver: { userId } },
    select: { id: true, status: true },
  });
  if (!trip) fail("Trip not found", "NotFoundError");
  if (!LIVE_STATUSES.includes(trip.status as (typeof LIVE_STATUSES)[number])) {
    fail("Chat is only available during an active trip", "ConflictError");
  }
  return trip;
}

export async function listTripMessages(userId: string, tripId: string, role: "RIDER" | "DRIVER") {
  await assertLiveTripAccess(userId, tripId, role);
  const rows = await prisma.tripMessage.findMany({
    where: { tripId },
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return rows.map(serializeMessage);
}

export async function createTripMessage(
  userId: string,
  tripId: string,
  role: "RIDER" | "DRIVER",
  body: string,
) {
  const text = body.trim();
  if (text.length < 1) fail("Message cannot be empty", "ConflictError");
  await assertLiveTripAccess(userId, tripId, role);
  const row = await prisma.tripMessage.create({
    data: { tripId, authorId: userId, body: text },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
  const message = serializeMessage(row);
  emitTripEvent(tripId, "trip:message", message);
  return message;
}
