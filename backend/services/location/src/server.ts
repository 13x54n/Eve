import "dotenv/config";
import { createLocationApp } from "./app.js";
import { rebuildGeoIndexes } from "./matching.js";

const port = Number(process.env.LOCATION_PORT || 4002);
createLocationApp().listen(port, "0.0.0.0", () => {
  console.log(`Location service running on port ${port}`);
  void rebuildGeoIndexes().catch((error) => {
    console.warn("Failed to rebuild matchmaking geo indexes", error);
  });
});
