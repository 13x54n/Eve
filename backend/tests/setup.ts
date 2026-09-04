import "dotenv/config";
import { beforeAll } from "vitest";
import { pingRedis, resetGeoIndexes } from "@eve/location";

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = "test-secret-for-automated-tests";
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";
  process.env.PRIVY_APP_ID ??= "test-privy-app-id";
  process.env.PRIVY_APP_SECRET ??= "test-privy-app-secret";
  process.env.REDIS_URL ??= "redis://127.0.0.1:6379";

  const reachable = await Promise.race([
    pingRedis(),
    new Promise<false>((resolve) => {
      setTimeout(() => resolve(false), 2000);
    }),
  ]);
  if (!reachable) {
    console.warn("Redis is not reachable at REDIS_URL; matchmaking tests will use Haversine fallback");
    return;
  }
  await resetGeoIndexes();
});
