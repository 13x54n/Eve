import { existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { loadProto, promisifyUnaryCall, resolveProtoPath } from "@eve/grpc";

describe("@eve/grpc", () => {
  it("resolves proto files from a backend cwd", () => {
    const locationPath = resolveProtoPath("backend/proto/location.proto");
    expect(existsSync(locationPath)).toBe(true);
    expect(locationPath.replace(/\\/g, "/")).toMatch(/proto\/location\.proto$/);
  });

  it("loads LocationService from location.proto", () => {
    const proto = loadProto("backend/proto/location.proto", "eve.location");
    expect(proto.LocationService).toBeTypeOf("function");
    expect(proto.LocationService.service).toBeTruthy();
  });

  it("loads NotifyService from notify.proto", () => {
    const proto = loadProto("backend/proto/notify.proto", "eve.notify");
    expect(proto.NotifyService).toBeTypeOf("function");
    expect(proto.NotifyService.service).toBeTruthy();
  });

  it("throws when the proto package is missing", () => {
    expect(() => loadProto("backend/proto/location.proto", "eve.missing")).toThrow(
      /Package eve.missing not found/,
    );
  });

  it("throws when the proto file cannot be resolved", () => {
    expect(() => resolveProtoPath("backend/proto/does-not-exist.proto")).toThrow(/Proto file not found/);
  });

  it("resolves an absolute proto path", () => {
    const absolute = join(process.cwd(), "proto", "notify.proto");
    expect(resolveProtoPath(absolute)).toBe(absolute);
  });

  it("promisifyUnaryCall resolves the callback response", async () => {
    const client = {
      Echo(request: { n: number }, callback: (err: Error | null, response: { n: number }) => void) {
        callback(null, { n: request.n + 1 });
      },
    };
    await expect(promisifyUnaryCall(client, "Echo", { n: 1 })).resolves.toEqual({ n: 2 });
  });

  it("promisifyUnaryCall rejects a service error", async () => {
    const error = Object.assign(new Error("nope"), { code: 3 });
    const client = {
      Echo(_request: unknown, callback: (err: Error | null) => void) {
        callback(error);
      },
    };
    await expect(promisifyUnaryCall(client, "Echo", {})).rejects.toMatchObject({ message: "nope", code: 3 });
  });
});
