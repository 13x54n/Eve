import "dotenv/config";
import { createRideApp } from "./app.js";

const port = Number(process.env.RIDE_PORT || 4003);
createRideApp().listen(port, "0.0.0.0", () => {
  console.log(`Ride service running on port ${port}`);
});
