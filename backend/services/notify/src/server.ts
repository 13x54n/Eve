import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { corsOptions } from "@eve/http";
import { createNotifyApp } from "./app.js";
import { attachRealtime } from "./realtime.js";

const port = Number(process.env.NOTIFY_PORT || 4004);
const app = createNotifyApp();
const httpServer = createServer(app);
const socketServer = new Server(httpServer, { cors: corsOptions() });
attachRealtime(socketServer);

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Notify service running on port ${port}`);
});
