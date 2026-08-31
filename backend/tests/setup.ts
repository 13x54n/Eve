import "dotenv/config";
import { beforeAll } from "vitest";
import { pingRedis, resetGeoIndexes } from "@eve/location";

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = "test-secret-for-automated-tests";
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";
  process.env.AUTH0_DOMAIN ??= "example.us.auth0.com";
  process.env.AUTH0_CLIENT_ID ??= "test-auth0-client-id";
  process.env.REDIS_URL ??= "redis://127.0.0.1:6379";

  const reachable = await pingRedis();
  if (!reachable) {
    console.warn("Redis is not reachable at REDIS_URL; matchmaking tests will use Haversine fallback");
    return;
  }
  await resetGeoIndexes();
});
