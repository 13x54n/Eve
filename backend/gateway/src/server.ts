import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { corsOptions } from "@eve/http";
import { rebuildGeoIndexes } from "@eve/location";
import { attachRealtime } from "@eve/notify";
import { createComposeApp } from "./compose-app.js";
import { createProxyApp } from "./proxy-app.js";

const port = Number(process.env.PORT || 4000);
const mode = process.env.GATEWAY_MODE || "compose";
const app = mode === "proxy" ? createProxyApp() : createComposeApp();
const httpServer = createServer(app);

if (mode !== "proxy") {
  const socketServer = new Server(httpServer, { cors: corsOptions() });
  attachRealtime(socketServer);
}

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Gateway running on port ${port} (${mode})`);
  if (mode !== "proxy") {
    void rebuildGeoIndexes().catch((error) => {
      console.warn("Failed to rebuild matchmaking geo indexes", error);
    });
  }
});
