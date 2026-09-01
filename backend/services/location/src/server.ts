import "dotenv/config";
import { createLocationApp } from "./app.js";
import { rebuildGeoIndexes } from "./matching.js";
import { startLocationGrpcServer } from "./grpc-server.js";

const httpPort = Number(process.env.LOCATION_PORT || 4002);
const grpcPort = Number(process.env.LOCATION_GRPC_PORT || 50051);

// Start HTTP server
createLocationApp().listen(httpPort, "0.0.0.0", () => {
  console.log(`Location service HTTP running on port ${httpPort}`);
  void rebuildGeoIndexes().catch((error) => {
    console.warn("Failed to rebuild matchmaking geo indexes", error);
  });
});

// Start gRPC server if enabled
if (process.env.GRPC_ENABLED === 'true') {
  startLocationGrpcServer(grpcPort).catch((error) => {
    console.error('Failed to start Location gRPC server:', error);
    process.exit(1);
  });
}
