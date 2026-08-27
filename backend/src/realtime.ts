import type { Server } from "socket.io";
import { verifyAccessToken } from "./utils/jwt.js";
import { prisma } from "./config/prisma.js";

let io: Server | null = null;

export function attachRealtime(server: Server) {
  io = server;
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("Authentication required"));
      socket.data.user = verifyAccessToken(token);
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as { sub: string; role: string };
    socket.join(`${user.role.toLowerCase()}:${user.sub}`);
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
      await prisma.driverProfile.update({
        where: { userId: user.sub },
        data: { latitude: payload.latitude, longitude: payload.longitude },
      });
      const activeTrips = await prisma.trip.findMany({
        where: { driver: { userId: user.sub }, status: { in: ["ASSIGNED", "ONGOING"] } },
        select: { id: true },
      });
      activeTrips.forEach((trip) => {
        emitTripEvent(trip.id, "driver:location", {
          latitude: payload.latitude,
          longitude: payload.longitude,
          timestamp: new Date().toISOString(),
        });
      });
    });
  });
}

export function emitTripEvent(tripId: string, event: string, payload: unknown) {
  io?.to(`trip:${tripId}`).emit(event, payload);
}

export function emitUserEvent(role: "RIDER" | "DRIVER", userId: string, event: string, payload: unknown) {
  io?.to(`${role.toLowerCase()}:${userId}`).emit(event, payload);
}
