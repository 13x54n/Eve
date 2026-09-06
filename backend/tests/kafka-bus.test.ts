import { afterEach, describe, expect, it } from "vitest";
import {
  EVE_TOPICS,
  publishEveEvent,
  resetKafkaMemoryForTests,
  subscribeEveTopic,
  type EveEvent,
} from "@eve/shared/kafka";

describe("Eve Kafka in-process bus", () => {
  afterEach(() => {
    resetKafkaMemoryForTests();
  });

  it("delivers a trip event to each consumer group", async () => {
    const seen: EveEvent[] = [];
    await subscribeEveTopic({
      groupId: "eve-notify",
      topic: EVE_TOPICS.trip,
      handler: (event) => {
        seen.push(event);
      },
    });
    await subscribeEveTopic({
      groupId: "eve-audit",
      topic: EVE_TOPICS.trip,
      handler: (event) => {
        seen.push(event);
      },
    });
    await publishEveEvent(EVE_TOPICS.trip, {
      type: "trip:completed",
      key: "trip-1",
      payload: { ok: true },
    });
    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatchObject({ type: "trip:completed", key: "trip-1" });
  });

  it("does not duplicate within the same group", async () => {
    const seen: string[] = [];
    await subscribeEveTopic({
      groupId: "eve-notify",
      topic: EVE_TOPICS.payment,
      handler: () => {
        seen.push("a");
      },
    });
    await subscribeEveTopic({
      groupId: "eve-notify",
      topic: EVE_TOPICS.payment,
      handler: () => {
        seen.push("b");
      },
    });
    await publishEveEvent(EVE_TOPICS.payment, {
      type: "escrow.released",
      key: "trip-2",
      payload: {},
    });
    expect(seen).toEqual(["a"]);
  });

  it("delivers auth registration events", async () => {
    const seen: string[] = [];
    await subscribeEveTopic({
      groupId: "eve-notify",
      topic: EVE_TOPICS.auth,
      handler: (event) => {
        seen.push(event.type);
      },
    });
    await publishEveEvent(EVE_TOPICS.auth, {
      type: "auth:user.registered",
      key: "user-1",
      payload: { role: "RIDER" },
    });
    expect(seen).toEqual(["auth:user.registered"]);
  });

  it("carries notifyUser on trip events without a second user-topic copy", async () => {
    const trip: EveEvent[] = [];
    const user: EveEvent[] = [];
    await subscribeEveTopic({
      groupId: "eve-notify",
      topic: EVE_TOPICS.trip,
      handler: (event) => {
        trip.push(event);
      },
    });
    await subscribeEveTopic({
      groupId: "eve-notify",
      topic: EVE_TOPICS.user,
      handler: (event) => {
        user.push(event);
      },
    });
    await publishEveEvent(EVE_TOPICS.trip, {
      type: "trip:completed",
      key: "trip-9",
      payload: { ok: true },
      notifyUser: { role: "RIDER", userId: "rider-1" },
    });
    expect(trip).toHaveLength(1);
    expect(trip[0]?.notifyUser).toEqual({ role: "RIDER", userId: "rider-1" });
    expect(user).toHaveLength(0);
  });
});
