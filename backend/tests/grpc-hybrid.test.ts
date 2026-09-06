import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as locationGrpc from "../services/location/src/grpc-client.js";
import * as locationMatching from "../services/location/src/matching.js";
import { nearbyDrivers, recordDriverLocation } from "../services/location/src/client.js";
import * as notifyGrpc from "../services/notify/src/grpc-client.js";
import { emitTripAndUserEvent, emitTripEvent, setSocketServer } from "../services/notify/src/emit.js";
import {
  EVE_TOPICS,
  resetKafkaMemoryForTests,
  subscribeEveTopic,
  type EveEvent,
} from "@eve/shared/kafka";

const nearbyInput = {
  pickupLat: 37.7749,
  pickupLng: -122.4194,
  vehicleType: "CAR" as const,
};

describe("location gRPC-first client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete process.env.LOCATION_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.LOCATION_URL;
  });

  it("uses gRPC when the call succeeds", async () => {
    process.env.LOCATION_URL = "http://location.test";
    vi.spyOn(locationGrpc, "nearbyDriversGrpc").mockResolvedValue([{ id: "grpc-1" } as any]);
    vi.spyOn(locationMatching, "nearbyDrivers").mockResolvedValue([{ id: "local-1" } as any]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(nearbyDrivers(nearbyInput)).resolves.toEqual([{ id: "grpc-1" }]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(locationMatching.nearbyDrivers).not.toHaveBeenCalled();
  });

  it("falls back to local matching when gRPC fails", async () => {
    vi.spyOn(locationGrpc, "nearbyDriversGrpc").mockRejectedValue(new Error("unavailable"));
    vi.spyOn(locationMatching, "nearbyDrivers").mockResolvedValue([{ id: "local-1" } as any]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(nearbyDrivers(nearbyInput)).resolves.toEqual([{ id: "local-1" }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to local recordDriverLocation when gRPC fails", async () => {
    process.env.LOCATION_URL = "http://location.test";
    vi.spyOn(locationGrpc, "recordDriverLocationGrpc").mockRejectedValue(new Error("unavailable"));
    vi.spyOn(locationMatching, "recordDriverLocation").mockResolvedValue(["trip-local"]);
    vi.stubGlobal("fetch", vi.fn());

    await expect(recordDriverLocation("driver-1", 1, 2)).resolves.toEqual(["trip-local"]);
  });
});

describe("notify hybrid emit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setSocketServer(null);
    delete process.env.NOTIFY_URL;
  });

  afterEach(() => {
    setSocketServer(null);
    vi.unstubAllGlobals();
    delete process.env.NOTIFY_URL;
    resetKafkaMemoryForTests();
  });

  it("emits on the local socket server and skips gRPC", async () => {
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    setSocketServer({ to } as any);
    vi.spyOn(notifyGrpc, "emitTripEventGrpc").mockResolvedValue(undefined);

    await emitTripEvent("trip-1", "trip.updated", { ok: true });

    expect(to).toHaveBeenCalledWith("trip:trip-1");
    expect(emit).toHaveBeenCalledWith("trip.updated", { ok: true });
    expect(notifyGrpc.emitTripEventGrpc).not.toHaveBeenCalled();
  });

  it("uses gRPC when there is no local io", async () => {
    vi.spyOn(notifyGrpc, "emitTripEventGrpc").mockResolvedValue(undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await emitTripEvent("trip-1", "trip.updated", { ok: true });

    expect(notifyGrpc.emitTripEventGrpc).toHaveBeenCalledWith("trip-1", "trip.updated", { ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to HTTP /internal/emit when gRPC fails", async () => {
    process.env.NOTIFY_URL = "http://notify.test";
    vi.spyOn(notifyGrpc, "emitTripEventGrpc").mockRejectedValue(new Error("unavailable"));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await emitTripEvent("trip-1", "trip.updated", { ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://notify.test/internal/emit");
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      target: "trip",
      tripId: "trip-1",
      event: "trip.updated",
      payload: { ok: true },
    });
  });

  it("publishes trip-and-user as one trip event with notifyUser", async () => {
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
    vi.spyOn(notifyGrpc, "emitTripAndUserEventGrpc").mockResolvedValue(undefined);

    await emitTripAndUserEvent("trip-1", "RIDER", "rider-1", "trip:completed", { ok: true });

    expect(trip).toHaveLength(1);
    expect(trip[0]).toMatchObject({
      type: "trip:completed",
      key: "trip-1",
      notifyUser: { role: "RIDER", userId: "rider-1" },
    });
    expect(user).toHaveLength(0);
    expect(notifyGrpc.emitTripAndUserEventGrpc).toHaveBeenCalledWith(
      "trip-1",
      "RIDER",
      "rider-1",
      "trip:completed",
      { ok: true },
    );
  });
});
