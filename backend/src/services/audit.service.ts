import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";

export async function writeAudit(input: {
  actorId?: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata,
      ip: input.ip,
    },
  });
}

export async function recordTripEvent(input: {
  tripId: string;
  actorId?: string;
  action: string;
  details?: Prisma.InputJsonValue;
}) {
  await prisma.tripEvent.create({
    data: {
      tripId: input.tripId,
      actorId: input.actorId,
      action: input.action,
      details: input.details,
    },
  });
}
