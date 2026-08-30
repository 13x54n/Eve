import { createClient, type RedisClientType } from "redis";

const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;
let fallbackLogged = false;

export function redisUrl() {
  return process.env.REDIS_URL || DEFAULT_REDIS_URL;
}

export function logGeoFallback(reason?: unknown) {
  if (fallbackLogged) return;
  fallbackLogged = true;
  console.warn("Matchmaking falling back to Haversine; Redis GEOSEARCH unavailable", reason ?? "");
}

export async function getRedis(): Promise<RedisClientType | null> {
  if (client?.isOpen) return client;
  if (connecting) return connecting;
  connecting = connect();
  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

async function connect(): Promise<RedisClientType | null> {
  const next = createClient({
    url: redisUrl(),
    socket: { connectTimeout: 1000 },
  });
  next.on("error", () => {
    // Avoid crashing the process on a dropped connection; callers fall back.
  });
  try {
    await next.connect();
    client = next as RedisClientType;
    return client;
  } catch (error) {
    logGeoFallback(error);
    try {
      await next.close();
    } catch {
      // ignore
    }
    return null;
  }
}

export async function pingRedis() {
  const redis = await getRedis();
  if (!redis) return false;
  try {
    return String(await redis.ping()) === "PONG";
  } catch (error) {
    logGeoFallback(error);
    return false;
  }
}
