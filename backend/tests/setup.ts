import "dotenv/config";
import { beforeAll } from "vitest";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = "test-secret-for-automated-tests";
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";
});