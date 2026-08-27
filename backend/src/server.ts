import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { attachRealtime } from "./realtime.js";

const port = Number(process.env.PORT || 4000);
const httpServer = createServer(app);
const socketServer = new Server(httpServer, { cors: { origin: true, credentials: true } });
attachRealtime(socketServer);

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`API server running on port ${port}`);
});