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
});
