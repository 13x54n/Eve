import { createProxyMiddleware } from "http-proxy-middleware";
import { applyErrorHandler, createBaseApp, healthPayload } from "@eve/http";
import adminRoutes from "./admin.routes.js";

function requiredUrl(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function createProxyApp() {
  const authUrl = requiredUrl("AUTH_URL");
  const locationUrl = requiredUrl("LOCATION_URL");
  const rideUrl = requiredUrl("RIDE_URL");
  const notifyUrl = requiredUrl("NOTIFY_URL");

  const app = createBaseApp();
  app.get("/api/health", (_req, res) => res.json(healthPayload("gateway")));
  app.use("/api/admin", adminRoutes);

  app.use(
    "/api/auth",
    createProxyMiddleware({ target: authUrl, changeOrigin: true }),
  );
  app.use(
    "/api/driver/register",
    createProxyMiddleware({ target: authUrl, changeOrigin: true }),
  );
  app.use(
    "/api/driver/login",
    createProxyMiddleware({ target: authUrl, changeOrigin: true }),
  );
  app.use(
    "/api/driver/presence",
    createProxyMiddleware({ target: locationUrl, changeOrigin: true }),
  );
  app.use(
    "/socket.io",
    createProxyMiddleware({ target: notifyUrl, changeOrigin: true, ws: true }),
  );
  app.use(
    "/api/rider",
    createProxyMiddleware({ target: rideUrl, changeOrigin: true }),
  );
  app.use(
    "/api/public",
    createProxyMiddleware({ target: rideUrl, changeOrigin: true }),
  );
  app.use(
    "/api/driver",
    createProxyMiddleware({ target: rideUrl, changeOrigin: true }),
  );

  applyErrorHandler(app);
  return app;
}
