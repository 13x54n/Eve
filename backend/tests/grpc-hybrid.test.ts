import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as locationGrpc from "../services/location/src/grpc-client.js";
import * as locationMatching from "../services/location/src/matching.js";
import { nearbyDrivers, recordDriverLocation } from "../services/location/src/client.js";
import * as notifyGrpc from "../services/notify/src/grpc-client.js";
import { emitTripEvent, setSocketServer } from "../services/notify/src/emit.js";

const nearbyInput = {
  pickupLat: 37.7749,
  pickupLng: -122.4194,
  vehicleType: "CAR" as const,
};

describe("location hybrid client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete process.env.GRPC_ENABLED;
    delete process.env.LOCATION_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GRPC_ENABLED;
    delete process.env.LOCATION_URL;
  });

  it("uses HTTP when gRPC is disabled and LOCATION_URL is set", async () => {
    process.env.LOCATION_URL = "http://location.test";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ drivers: [{ id: "http-1" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(locationMatching, "nearbyDrivers").mockResolvedValue([{ id: "local-1" } as any]);
    vi.spyOn(locationGrpc, "nearbyDriversGrpc").mockResolvedValue([{ id: "grpc-1" } as any]);

    await expect(nearbyDrivers(nearbyInput)).resolves.toEqual([{ id: "http-1" }]);
    expect(locationGrpc.nearbyDriversGrpc).not.toHaveBeenCalled();
    expect(locationMatching.nearbyDrivers).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
  });

  it("uses local matching when gRPC is disabled and LOCATION_URL is unset", async () => {
    vi.spyOn(locationMatching, "nearbyDrivers").mockResolvedValue([{ id: "local-1" } as any]);
    const grpcSpy = vi.spyOn(locationGrpc, "nearbyDriversGrpc");
    await expect(nearbyDrivers(nearbyInput)).resolves.toEqual([{ id: "local-1" }]);
    expect(grpcSpy).not.toHaveBeenCalled();
  });

  it("uses gRPC when enabled and the call succeeds", async () => {
    process.env.GRPC_ENABLED = "true";
    process.env.LOCATION_URL = "http://location.test";
    vi.spyOn(locationGrpc, "nearbyDriversGrpc").mockResolvedValue([{ id: "grpc-1" } as any]);
    vi.spyOn(locationMatching, "nearbyDrivers").mockResolvedValue([{ id: "local-1" } as any]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(nearbyDrivers(nearbyInput)).resolves.toEqual([{ id: "grpc-1" }]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(locationMatching.nearbyDrivers).not.toHaveBeenCalled();
  });

  it("falls back from gRPC to HTTP for nearbyDrivers", async () => {
    process.env.GRPC_ENABLED = "true";
    process.env.LOCATION_URL = "http://location.test";
    vi.spyOn(locationGrpc, "nearbyDriversGrpc").mockRejectedValue(new Error("unavailable"));
    vi.spyOn(locationMatching, "nearbyDrivers").mockResolvedValue([{ id: "local-1" } as any]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ drivers: [{ id: "http-2" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(nearbyDrivers(nearbyInput)).resolves.toEqual([{ id: "http-2" }]);
    expect(locationMatching.nearbyDrivers).not.toHaveBeenCalled();
  });

  it("falls back from gRPC and HTTP to local recordDriverLocation", async () => {
    process.env.GRPC_ENABLED = "true";
    process.env.LOCATION_URL = "http://location.test";
    vi.spyOn(locationGrpc, "recordDriverLocationGrpc").mockRejectedValue(new Error("unavailable"));
    vi.spyOn(locationMatching, "recordDriverLocation").mockResolvedValue(["trip-local"]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(recordDriverLocation("driver-1", 1, 2)).resolves.toEqual(["trip-local"]);
  });
});

describe("notify hybrid emit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setSocketServer(null);
    delete process.env.GRPC_ENABLED;
    delete process.env.NOTIFY_URL;
  });

  afterEach(() => {
    setSocketServer(null);
    vi.unstubAllGlobals();
    delete process.env.GRPC_ENABLED;
    delete process.env.NOTIFY_URL;
  });

  it("emits on the local socket server and skips gRPC", async () => {
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    setSocketServer({ to } as any);
    process.env.GRPC_ENABLED = "true";
    vi.spyOn(notifyGrpc, "emitTripEventGrpc").mockResolvedValue(undefined);

    await emitTripEvent("trip-1", "trip.updated", { ok: true });

    expect(to).toHaveBeenCalledWith("trip:trip-1");
    expect(emit).toHaveBeenCalledWith("trip.updated", { ok: true });
    expect(notifyGrpc.emitTripEventGrpc).not.toHaveBeenCalled();
  });

  it("uses gRPC when there is no local io and GRPC_ENABLED is true", async () => {
    process.env.GRPC_ENABLED = "true";
    vi.spyOn(notifyGrpc, "emitTripEventGrpc").mockResolvedValue(undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await emitTripEvent("trip-1", "trip.updated", { ok: true });

    expect(notifyGrpc.emitTripEventGrpc).toHaveBeenCalledWith("trip-1", "trip.updated", { ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to HTTP /internal/emit when gRPC fails", async () => {
    process.env.GRPC_ENABLED = "true";
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
});
