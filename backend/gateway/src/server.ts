import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { attachRealtime } from "@eve/notify";
import { createComposeApp } from "./compose-app.js";
import { createProxyApp } from "./proxy-app.js";

const port = Number(process.env.PORT || 4000);
const mode = process.env.GATEWAY_MODE || "compose";
const app = mode === "proxy" ? createProxyApp() : createComposeApp();
const httpServer = createServer(app);

if (mode !== "proxy") {
  const socketServer = new Server(httpServer, { cors: { origin: true, credentials: true } });
  attachRealtime(socketServer);
}

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Gateway running on port ${port} (${mode})`);
});
