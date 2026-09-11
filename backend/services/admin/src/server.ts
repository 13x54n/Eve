import "dotenv/config";
import { createAdminApp } from "./app.js";

const port = Number(process.env.ADMIN_PORT || 4005);
createAdminApp().listen(port, "0.0.0.0", () => {
  console.log(`Admin service running on port ${port}`);
});
