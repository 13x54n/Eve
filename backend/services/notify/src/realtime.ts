import type { Server as SocketServer } from "socket.io";
import { verifyAccessToken } from "@eve/shared";
import { recordDriverLocationClient as recordDriverLocation } from "@eve/location";
import { setSocketServer, emitAdminEventLocal, emitTripEventLocal } from "./emit.js";

export function attachRealtime(server: SocketServer) {
  setSocketServer(server);
  server.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("Authentication required"));
      socket.data.user = verifyAccessToken(token);
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  server.on("connection", (socket) => {
    const user = socket.data.user as { sub: string; role: string };
    socket.join(`${user.role.toLowerCase()}:${user.sub}`);
    if (user.role === "ADMIN") {
      socket.join("admin:ops");
    }
    socket.on("trip:subscribe", (tripId: string) => {
      if (typeof tripId === "string" && tripId.length > 0) socket.join(`trip:${tripId}`);
    });
    socket.on("driver:location", async (payload: { latitude?: number; longitude?: number }) => {
      if (user.role !== "DRIVER") return;
      if (
        typeof payload?.latitude !== "number" ||
        typeof payload?.longitude !== "number" ||
        payload.latitude < -90 || payload.latitude > 90 ||
        payload.longitude < -180 || payload.longitude > 180
      ) return;
      const tripIds = await recordDriverLocation(user.sub, payload.latitude, payload.longitude);
      const body = {
        userId: user.sub,
        latitude: payload.latitude,
        longitude: payload.longitude,
        timestamp: new Date().toISOString(),
      };
      emitAdminEventLocal("driver:location", body);
      for (const tripId of tripIds) {
        emitTripEventLocal(tripId, "driver:location", body);
      }
    });
  });
}
