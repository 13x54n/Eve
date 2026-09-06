import { EVE_TOPICS, isKafkaEnabled, subscribeEveTopic, type EveEvent } from "@eve/shared/kafka";
import {
  emitAdminEventLocal,
  emitTripAndUserEventLocal,
  emitTripEventLocal,
  emitUserEventLocal,
} from "./emit.js";

function userBody(event: EveEvent) {
  const payload = event.payload as { role?: string; body?: unknown } | null;
  const role = payload?.role === "DRIVER" ? "DRIVER" : "RIDER";
  return { role: role as "RIDER" | "DRIVER", body: payload?.body ?? event.payload };
}

export async function startNotifyKafkaConsumers() {
  if (!isKafkaEnabled()) return;
  await subscribeEveTopic({
    groupId: "eve-notify",
    topic: EVE_TOPICS.trip,
    handler: (event) => {
      if (event.notifyUser) {
        emitTripAndUserEventLocal(
          event.key,
          event.notifyUser.role,
          event.notifyUser.userId,
          event.type,
          event.payload,
        );
        return;
      }
      emitTripEventLocal(event.key, event.type, event.payload);
    },
  });
  await subscribeEveTopic({
    groupId: "eve-notify",
    topic: EVE_TOPICS.user,
    handler: (event) => {
      const { role, body } = userBody(event);
      emitUserEventLocal(role, event.key, event.type, body);
    },
  });
  await subscribeEveTopic({
    groupId: "eve-notify",
    topic: EVE_TOPICS.admin,
    handler: (event) => {
      emitAdminEventLocal(event.type, event.payload);
    },
  });
  await subscribeEveTopic({
    groupId: "eve-notify",
    topic: EVE_TOPICS.auth,
    handler: (event) => {
      emitAdminEventLocal(event.type, event.payload);
    },
  });
  await subscribeEveTopic({
    groupId: "eve-notify",
    topic: EVE_TOPICS.payment,
    handler: (event) => {
      emitTripEventLocal(event.key, event.type, event.payload);
    },
  });
  console.log("Notify Kafka consumers subscribed");
}
