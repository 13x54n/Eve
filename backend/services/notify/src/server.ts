import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { corsOptions } from "@eve/http";
import { createNotifyApp } from "./app.js";
import { attachRealtime } from "./realtime.js";
import { startNotifyGrpcServer } from "./grpc-server.js";

const httpPort = Number(process.env.NOTIFY_PORT || 4004);
const grpcPort = Number(process.env.NOTIFY_GRPC_PORT || 50052);

// Start HTTP + WebSocket server
const app = createNotifyApp();
const httpServer = createServer(app);
const socketServer = new Server(httpServer, { cors: corsOptions() });
attachRealtime(socketServer);

httpServer.listen(httpPort, "0.0.0.0", () => {
  console.log(`Notify service HTTP running on port ${httpPort}`);
});

// Start gRPC server if enabled
if (process.env.GRPC_ENABLED === 'true') {
  startNotifyGrpcServer(grpcPort).catch((error) => {
    console.error('Failed to start Notify gRPC server:', error);
    process.exit(1);
  });
}
