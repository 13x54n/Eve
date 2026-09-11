import "dotenv/config";
import { createAuthApp } from "./app.js";

const port = Number(process.env.AUTH_PORT || 4001);
createAuthApp().listen(port, "0.0.0.0", () => {
  console.log(`Auth service running on port ${port}`);
});
