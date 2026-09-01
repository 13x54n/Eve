import type { Server as SocketServer } from "socket.io";
import { verifyAccessToken } from "@eve/shared";
import { recordDriverLocationClient as recordDriverLocation } from "@eve/location";
import { prisma } from "@eve/db";
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
    socket.on("trip:subscribe", async (tripId: string) => {
      if (typeof tripId !== "string" || tripId.length === 0) return;
      
      // Verify user is rider or driver on this trip
      try {
        const trip = await prisma.trip.findUnique({
          where: { id: tripId },
          select: { riderId: true, driverId: true }
        });
        
        if (!trip) {
          socket.emit("error", { message: "Trip not found" });
          return;
        }
        
        if (trip.riderId !== user.sub && trip.driverId !== user.sub) {
          socket.emit("error", { message: "Unauthorized: You are not a participant in this trip" });
          return;
        }
        
        socket.join(`trip:${tripId}`);
      } catch (error) {
        socket.emit("error", { message: "Failed to subscribe to trip" });
      }
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
