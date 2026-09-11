import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;

export function redisUrl() {
  const url = process.env.REDIS_URL?.trim();
  return url || undefined;
}

async function getRedis(): Promise<RedisClientType | null> {
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
  const url = redisUrl();
  if (!url) {
    console.warn("REDIS_URL is not set; caching disabled");
    return null;
  }
  const next = createClient({
    url,
    socket: { connectTimeout: 1000 },
  });
  next.on("error", (error) => {
    console.warn("Redis connection error:", error.message);
  });
  try {
    await next.connect();
    client = next as RedisClientType;
    console.log("Redis cache service connected");
    return client;
  } catch (error) {
    console.warn("Failed to connect to Redis for caching:", error);
    try {
      await next.close();
    } catch {
      // ignore
    }
    return null;
  }
}

/**
 * Shared cache service for application-wide caching
 */
export class CacheService {
  private metrics = {
    hits: 0,
    misses: 0,
    errors: 0,
  };

  /**
   * Get a string value from cache
   */
  async get(key: string): Promise<string | null> {
    try {
      const redis = await getRedis();
      if (!redis) return null;
      
      const value = await redis.get(key);
      if (value) {
        this.metrics.hits++;
      } else {
        this.metrics.misses++;
      }
      return value;
    } catch (error) {
      this.metrics.errors++;
      console.warn("Cache get error for key:", key, error);
      return null;
    }
  }

  /**
   * Set a string value in cache with optional TTL (seconds)
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      const redis = await getRedis();
      if (!redis) return;
      
      if (ttl) {
        await redis.setEx(key, ttl, value);
      } else {
        await redis.set(key, value);
      }
    } catch (error) {
      this.metrics.errors++;
      console.warn("Cache set error for key:", key, error);
    }
  }

  /**
   * Get all fields from a hash
   */
  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      const redis = await getRedis();
      if (!redis) return {};
      
      const value = await redis.hGetAll(key);
      if (Object.keys(value).length > 0) {
        this.metrics.hits++;
      } else {
        this.metrics.misses++;
      }
      return value;
    } catch (error) {
      this.metrics.errors++;
      console.warn("Cache hGetAll error for key:", key, error);
      return {};
    }
  }

  /**
   * Set a single field in a hash
   */
  async hSet(key: string, field: string, value: string): Promise<void> {
    try {
      const redis = await getRedis();
      if (!redis) return;
      
      await redis.hSet(key, field, value);
    } catch (error) {
      this.metrics.errors++;
      console.warn("Cache hSet error for key:", key, error);
    }
  }

  /**
   * Set multiple fields in a hash
   */
  async hSetAll(key: string, fields: Record<string, string>): Promise<void> {
    try {
      const redis = await getRedis();
      if (!redis) return;
      
      await redis.hSet(key, fields);
    } catch (error) {
      this.metrics.errors++;
      console.warn("Cache hSetAll error for key:", key, error);
    }
  }

  /**
   * Delete one or more keys
   */
  async del(...keys: string[]): Promise<void> {
    try {
      const redis = await getRedis();
      if (!redis || keys.length === 0) return;
      
      await redis.del(keys);
    } catch (error) {
      this.metrics.errors++;
      console.warn("Cache del error for keys:", keys, error);
    }
  }

  /**
   * Set expiration time on a key (seconds)
   */
  async expire(key: string, seconds: number): Promise<void> {
    try {
      const redis = await getRedis();
      if (!redis) return;
      
      await redis.expire(key, seconds);
    } catch (error) {
      this.metrics.errors++;
      console.warn("Cache expire error for key:", key, error);
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const redis = await getRedis();
      if (!redis) return false;
      
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      this.metrics.errors++;
      console.warn("Cache exists error for key:", key, error);
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, by: number = 1): Promise<number> {
    try {
      const redis = await getRedis();
      if (!redis) return 0;
      
      return await redis.incrBy(key, by);
    } catch (error) {
      this.metrics.errors++;
      console.warn("Cache increment error for key:", key, error);
      return 0;
    }
  }

  /**
   * Decrement a counter
   */
  async decrement(key: string, by: number = 1): Promise<number> {
    try {
      const redis = await getRedis();
      if (!redis) return 0;
      
      return await redis.decrBy(key, by);
    } catch (error) {
      this.metrics.errors++;
      console.warn("Cache decrement error for key:", key, error);
      return 0;
    }
  }

  /**
   * Add member to sorted set with score
   */
  async zAdd(key: string, score: number, member: string): Promise<void> {
    try {
      const redis = await getRedis();
      if (!redis) return;
      
      await redis.zAdd(key, { score, value: member });
    } catch (error) {
      this.metrics.errors++;
      console.warn("Cache zAdd error for key:", key, error);
    }
  }

  /**
   * Get members from sorted set in reverse order (highest to lowest score)
   */
  async zRevRange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      const redis = await getRedis();
      if (!redis) return [];
      
      return await redis.zRevRange(key, start, stop);
    } catch (error) {
      this.metrics.errors++;
      console.warn("Cache zRevRange error for key:", key, error);
      return [];
    }
  }

  /**
   * Invalidate keys matching a pattern (use with caution)
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const redis = await getRedis();
      if (!redis) return 0;
      
      let cursor = 0;
      let deletedCount = 0;
      
      do {
        const result = await redis.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        cursor = result.cursor;
        
        if (result.keys.length > 0) {
          await redis.del(result.keys);
          deletedCount += result.keys.length;
        }
      } while (cursor !== 0);
      
      return deletedCount;
    } catch (error) {
      this.metrics.errors++;
      console.warn("Cache invalidatePattern error for pattern:", pattern, error);
      return 0;
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? this.metrics.hits / total : 0,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = { hits: 0, misses: 0, errors: 0 };
  }
}

// Singleton instance
export const cache = new CacheService();

/**
 * Generic cache-aside pattern wrapper
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
  serializer: (data: T) => string = JSON.stringify,
  deserializer: (data: string) => T = JSON.parse
): Promise<T> {
  try {
    const cached = await cache.get(key);
    if (cached) {
      return deserializer(cached);
    }
  } catch (error) {
    console.warn("Cache read error, falling back to fetcher:", error);
  }
  
  const fresh = await fetcher();
  
  try {
    await cache.set(key, serializer(fresh), ttl);
  } catch (error) {
    console.warn("Cache write error:", error);
  }
  
  return fresh;
}
