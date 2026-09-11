import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GrpcStatus, createGrpcClient, loadProto, promisifyUnaryCall, type ServiceError } from "@eve/grpc";
import type { GrpcServer } from "@eve/grpc";

const emitLocals = vi.hoisted(() => ({
  emitTripEventLocal: vi.fn(),
  emitUserEventLocal: vi.fn(),
  emitAdminEventLocal: vi.fn(),
  emitTripAndUserEventLocal: vi.fn(),
}));

vi.mock("../services/notify/src/emit.js", () => emitLocals);

import { startNotifyGrpcServer } from "../services/notify/src/grpc-server.js";
import {
  closeNotifyGrpcClient,
  emitAdminEventGrpc,
  emitTripAndUserEventGrpc,
  emitTripEventGrpc,
  emitUserEventGrpc,
} from "../services/notify/src/grpc-client.js";

function grpcCode(error: unknown) {
  return (error as ServiceError).code;
}

function collectStream(stream: { on: (event: string, listener: (...args: any[]) => void) => void }) {
  const events: unknown[] = [];
  return new Promise<unknown[]>((resolve, reject) => {
    stream.on("data", (event) => events.push(event));
    stream.on("end", () => resolve(events));
    stream.on("error", reject);
  });
}

describe("Notify gRPC", () => {
  let server: GrpcServer;
  let rawClient: any;

  beforeAll(async () => {
    closeNotifyGrpcClient();
    server = await startNotifyGrpcServer(0);
    process.env.NOTIFY_GRPC_URL = `127.0.0.1:${server.boundPort}`;

    const proto = loadProto("backend/proto/notify.proto", "eve.notify");
    rawClient = createGrpcClient(proto.NotifyService, { url: `127.0.0.1:${server.boundPort}` });
  });

  beforeEach(() => {
    emitLocals.emitTripEventLocal.mockReset();
    emitLocals.emitUserEventLocal.mockReset();
    emitLocals.emitAdminEventLocal.mockReset();
    emitLocals.emitTripAndUserEventLocal.mockReset();
  });

  afterAll(async () => {
    closeNotifyGrpcClient();
    rawClient?.close();
    delete process.env.NOTIFY_GRPC_URL;
    await server.shutdown();
  });

  it("emits a trip event with a parsed JSON payload", async () => {
    await emitTripEventGrpc("trip-1", "trip.updated", { status: "SEARCHING" });
    expect(emitLocals.emitTripEventLocal).toHaveBeenCalledWith("trip-1", "trip.updated", { status: "SEARCHING" });
  });

  it("emits user, admin, and combined events", async () => {
    await emitUserEventGrpc("DRIVER", "user-1", "driver.offer", { tripId: "t1" });
    await emitAdminEventGrpc("admin.alert", { count: 2 });
    await emitTripAndUserEventGrpc("trip-1", "RIDER", "user-2", "trip.matched", { ok: true });

    expect(emitLocals.emitUserEventLocal).toHaveBeenCalledWith("DRIVER", "user-1", "driver.offer", { tripId: "t1" });
    expect(emitLocals.emitAdminEventLocal).toHaveBeenCalledWith("admin.alert", { count: 2 });
    expect(emitLocals.emitTripAndUserEventLocal).toHaveBeenCalledWith("trip-1", "RIDER", "user-2", "trip.matched", {
      ok: true,
    });
  });

  it("treats an empty payload as {}", async () => {
    await promisifyUnaryCall(rawClient, "EmitTripEvent", { trip_id: "trip-1", event: "noop" });
    expect(emitLocals.emitTripEventLocal).toHaveBeenCalledWith("trip-1", "noop", {});
  });

  it("rejects invalid JSON payloads", async () => {
    await expect(
      promisifyUnaryCall(rawClient, "EmitTripEvent", { trip_id: "trip-1", event: "x", payload: "{" }),
    ).rejects.toSatisfy((error: unknown) => grpcCode(error) === GrpcStatus.INVALID_ARGUMENT);
    expect(emitLocals.emitTripEventLocal).not.toHaveBeenCalled();
  });

  it("rejects emit calls that are missing required fields", async () => {
    await expect(promisifyUnaryCall(rawClient, "EmitTripEvent", { event: "x" })).rejects.toSatisfy(
      (error: unknown) => grpcCode(error) === GrpcStatus.INVALID_ARGUMENT,
    );
    await expect(promisifyUnaryCall(rawClient, "EmitAdminEvent", {})).rejects.toSatisfy(
      (error: unknown) => grpcCode(error) === GrpcStatus.INVALID_ARGUMENT,
    );
  });

  it("rejects roles other than RIDER or DRIVER", async () => {
    await expect(
      promisifyUnaryCall(rawClient, "EmitUserEvent", {
        role: "ADMIN",
        user_id: "u1",
        event: "x",
        payload: "{}",
      }),
    ).rejects.toSatisfy((error: unknown) => grpcCode(error) === GrpcStatus.INVALID_ARGUMENT);
    await expect(
      promisifyUnaryCall(rawClient, "EmitTripAndUserEvent", {
        trip_id: "t1",
        role: "STAFF",
        user_id: "u1",
        event: "x",
        payload: "{}",
      }),
    ).rejects.toSatisfy((error: unknown) => grpcCode(error) === GrpcStatus.INVALID_ARGUMENT);
  });

  it("closes StreamAdminEvents without sending events", async () => {
    const events = await collectStream(rawClient.StreamAdminEvents({}));
    expect(events).toEqual([]);
  });

  it("closes StreamTripEvents without sending events", async () => {
    const events = await collectStream(rawClient.StreamTripEvents({ trip_id: "trip-1" }));
    expect(events).toEqual([]);
  });
});
