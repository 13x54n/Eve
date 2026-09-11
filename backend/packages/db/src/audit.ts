import type { Prisma } from "./generated/prisma/client.js";
import { prisma } from "./prisma.js";
import { enqueueWrite } from "@eve/shared";

export async function writeAudit(input: {
  actorId?: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}) {
  // Async write - non-blocking for audit logs
  enqueueWrite(() =>
    prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metadata: input.metadata,
        ip: input.ip,
      },
    })
  );
}

export async function recordTripEvent(input: {
  tripId: string;
  actorId?: string;
  action: string;
  details?: Prisma.InputJsonValue;
}) {
  // Async write - non-blocking for trip events
  enqueueWrite(() =>
    prisma.tripEvent.create({
      data: {
        tripId: input.tripId,
        actorId: input.actorId,
        action: input.action,
        details: input.details,
      },
    })
  );
}
