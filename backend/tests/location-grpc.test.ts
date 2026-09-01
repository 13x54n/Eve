import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GrpcStatus, createGrpcClient, loadProto, promisifyUnaryCall, type ServiceError } from "@eve/grpc";
import type { GrpcServer } from "@eve/grpc";

const matching = vi.hoisted(() => ({
  nearbyDrivers: vi.fn(),
  recordDriverLocation: vi.fn(),
  syncDriverGeo: vi.fn(),
  nearbySearchingTrips: vi.fn(),
  distanceToPickup: vi.fn(),
  indexSearchingTrip: vi.fn(),
  removeSearchingTrip: vi.fn(),
}));

vi.mock("../services/location/src/matching.js", () => matching);

import { startLocationGrpcServer } from "../services/location/src/grpc-server.js";
import {
  closeGrpcClient,
  createDriverLocationStream,
  distanceToPickupGrpc,
  indexSearchingTripGrpc,
  nearbyDriversGrpc,
  nearbySearchingTripsGrpc,
  recordDriverLocationGrpc,
  removeSearchingTripGrpc,
  syncDriverGeoGrpc,
} from "../services/location/src/grpc-client.js";

function grpcCode(error: unknown) {
  return (error as ServiceError).code;
}

describe("Location gRPC", () => {
  let server: GrpcServer;
  let rawClient: any;

  beforeAll(async () => {
    closeGrpcClient();
    server = await startLocationGrpcServer(0);
    process.env.LOCATION_GRPC_URL = `127.0.0.1:${server.boundPort}`;

    const proto = loadProto("backend/proto/location.proto", "eve.location");
    rawClient = createGrpcClient(proto.LocationService, { url: `127.0.0.1:${server.boundPort}` });
  });

  beforeEach(() => {
    matching.nearbyDrivers.mockReset();
    matching.recordDriverLocation.mockReset();
    matching.syncDriverGeo.mockReset();
    matching.nearbySearchingTrips.mockReset();
    matching.distanceToPickup.mockReset();
    matching.indexSearchingTrip.mockReset();
    matching.removeSearchingTrip.mockReset();
  });

  afterAll(async () => {
    closeGrpcClient();
    rawClient?.close();
    delete process.env.LOCATION_GRPC_URL;
    await server.shutdown();
  });

  it("records a driver location and returns nearby trip ids", async () => {
    matching.recordDriverLocation.mockResolvedValue(["trip-1", "trip-2"]);
    await expect(recordDriverLocationGrpc("driver-1", 37.77, -122.42)).resolves.toEqual(["trip-1", "trip-2"]);
    expect(matching.recordDriverLocation).toHaveBeenCalledWith("driver-1", 37.77, -122.42);
  });

  it("maps nearby drivers from proto snake_case to app fields", async () => {
    matching.nearbyDrivers.mockResolvedValue([
      { id: "dp-1", userId: "user-1", latitude: 37.78, longitude: -122.41, distance: 0.4 },
    ]);

    const drivers = await nearbyDriversGrpc({
      pickupLat: 37.7749,
      pickupLng: -122.4194,
      vehicleType: "CAR",
      excludeUserId: "self",
      matchAllVehicleTypes: true,
    });

    expect(matching.nearbyDrivers).toHaveBeenCalledWith({
      pickupLat: 37.7749,
      pickupLng: -122.4194,
      vehicleType: "CAR",
      excludeUserId: "self",
      matchAllVehicleTypes: true,
    });
    expect(drivers).toEqual([
      { id: "dp-1", userId: "user-1", latitude: 37.78, longitude: -122.41, distance: 0.4 },
    ]);
  });

  it("syncs driver geo, indexes trips, and reports distance", async () => {
    matching.syncDriverGeo.mockResolvedValue(undefined);
    matching.distanceToPickup.mockResolvedValue(1.25);
    matching.indexSearchingTrip.mockResolvedValue(undefined);
    matching.removeSearchingTrip.mockResolvedValue(undefined);
    matching.nearbySearchingTrips.mockResolvedValue([{ id: "trip-9", distanceToPickup: 0.8 }]);

    await syncDriverGeoGrpc("driver-1");
    await expect(distanceToPickupGrpc("driver-1", 37.77, -122.42)).resolves.toBe(1.25);
    await indexSearchingTripGrpc({
      id: "trip-9",
      pickupLat: 37.77,
      pickupLng: -122.42,
      vehicleType: "BIKE",
      matchAllVehicleTypes: false,
    });
    await removeSearchingTripGrpc("trip-9", "BIKE");
    await expect(nearbySearchingTripsGrpc("driver-1")).resolves.toEqual([
      { id: "trip-9", distanceToPickup: 0.8 },
    ]);

    expect(matching.syncDriverGeo).toHaveBeenCalledWith("driver-1");
    expect(matching.indexSearchingTrip).toHaveBeenCalledWith({
      id: "trip-9",
      pickupLat: 37.77,
      pickupLng: -122.42,
      vehicleType: "BIKE",
      matchAllVehicleTypes: false,
    });
    expect(matching.removeSearchingTrip).toHaveBeenCalledWith("trip-9", "BIKE");
  });

  it("rejects RecordDriverLocation without user_id", async () => {
    await expect(promisifyUnaryCall(rawClient, "RecordDriverLocation", { latitude: 1, longitude: 2 })).rejects.toSatisfy(
      (error: unknown) => grpcCode(error) === GrpcStatus.INVALID_ARGUMENT,
    );
    expect(matching.recordDriverLocation).not.toHaveBeenCalled();
  });

  it("rejects NearbyDrivers without vehicle_type", async () => {
    await expect(
      promisifyUnaryCall(rawClient, "NearbyDrivers", { pickup_lat: 37.77, pickup_lng: -122.42 }),
    ).rejects.toSatisfy((error: unknown) => grpcCode(error) === GrpcStatus.INVALID_ARGUMENT);
  });

  it("rejects NearbyDrivers when vehicle_type is not BIKE or CAR", async () => {
    await expect(
      promisifyUnaryCall(rawClient, "NearbyDrivers", {
        pickup_lat: 37.77,
        pickup_lng: -122.42,
        vehicle_type: "VAN",
      }),
    ).rejects.toSatisfy((error: unknown) => grpcCode(error) === GrpcStatus.INVALID_ARGUMENT);
  });

  it("rejects RemoveSearchingTrip when vehicle_type is invalid", async () => {
    await expect(
      promisifyUnaryCall(rawClient, "RemoveSearchingTrip", { id: "trip-1", vehicle_type: "VAN" }),
    ).rejects.toSatisfy((error: unknown) => grpcCode(error) === GrpcStatus.INVALID_ARGUMENT);
    expect(matching.removeSearchingTrip).not.toHaveBeenCalled();
  });

  it("maps matching failures to INTERNAL", async () => {
    matching.recordDriverLocation.mockRejectedValue(new Error("redis down"));
    await expect(recordDriverLocationGrpc("driver-1", 1, 2)).rejects.toSatisfy(
      (error: unknown) => grpcCode(error) === GrpcStatus.INTERNAL,
    );
  });

  it("streams multiple GPS updates then closes", async () => {
    matching.recordDriverLocation
      .mockResolvedValueOnce(["trip-a"])
      .mockResolvedValueOnce(["trip-b"]);

    const stream = createDriverLocationStream();
    const batches: string[][] = [];
    const done = new Promise<void>((resolve, reject) => {
      stream.onData((tripIds) => {
        batches.push(tripIds);
        if (batches.length === 2) {
          stream.close();
        }
      });
      stream.onEnd(resolve);
      stream.onError(reject);
    });

    stream.send("driver-1", 37.77, -122.42);
    stream.send("driver-1", 37.78, -122.41);
    await done;

    expect(batches).toEqual([["trip-a"], ["trip-b"]]);
    expect(matching.recordDriverLocation).toHaveBeenCalledTimes(2);
  });

  it("errors the location stream on an invalid frame", async () => {
    const stream = createDriverLocationStream();
    const error = await new Promise<unknown>((resolve) => {
      stream.onError(resolve);
      stream.send("", 37.77, -122.42);
    });
    expect(grpcCode(error)).toBe(GrpcStatus.INVALID_ARGUMENT);
  });
});
