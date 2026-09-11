/**
 * In-Memory Fare Configuration Cache
 * 
 * Replaces Redis cache for fare configs (1-3ms → 0ms)
 * TTL: 1 hour (configs rarely change)
 * Invalidation: Via notify events when admin updates pricing
 */

import type { FareConfig } from "./fare.js";

interface CacheEntry {
  config: FareConfig;
  expiresAt: number;
}

class InMemoryFareCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 3600 * 1000; // 1 hour

  /**
   * Get fare config from cache
   */
  get(city: string, vehicleType: string): FareConfig | null {
    const key = `${city}:${vehicleType}`;
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.config;
  }

  /**
   * Set fare config in cache
   */
  set(city: string, vehicleType: string, config: FareConfig): void {
    const key = `${city}:${vehicleType}`;
    this.cache.set(key, {
      config,
      expiresAt: Date.now() + this.TTL,
    });
  }

  /**
   * Invalidate specific fare config
   */
  invalidate(city: string, vehicleType: string): void {
    const key = `${city}:${vehicleType}`;
    this.cache.delete(key);
  }

  /**
   * Invalidate all fare configs
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache size (for monitoring)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache stats
   */
  getStats() {
    let expired = 0;
    const now = Date.now();
    
    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      }
    }

    return {
      total: this.cache.size,
      expired,
      active: this.cache.size - expired,
    };
  }
}

/**
 * Singleton fare cache instance
 */
export const fareCache = new InMemoryFareCache();

/**
 * Get fare config with in-memory cache
 */
export async function getCachedFareConfig(
  city: string,
  vehicleType: string,
  fetchFn: () => Promise<FareConfig>
): Promise<FareConfig> {
  // Try in-memory cache first
  const cached = fareCache.get(city, vehicleType);
  if (cached) {
    return cached;
  }

  // Fetch from database
  const config = await fetchFn();
  
  // Cache result
  fareCache.set(city, vehicleType, config);
  
  return config;
}

/**
 * Invalidate fare cache (called when admin updates pricing)
 */
export function invalidateFareCacheMemory(city: string, vehicleType: string): void {
  fareCache.invalidate(city, vehicleType);
}

/**
 * Broadcast invalidation to all service instances (via notify)
 */
export async function broadcastFareInvalidation(
  city: string,
  vehicleType: string
): Promise<void> {
  // Import dynamically to avoid circular deps
  const { featureFlags } = await import('@eve/shared');
  
  if (featureFlags.isEnabled('USE_DIRECT_NOTIFY')) {
    const { emitAdminEvent } = await import('@eve/notify-client');
    await emitAdminEvent('fare:config:invalidated', { city, vehicleType });
  } else {
    const { emitAdminEvent } = await import('@eve/notify');
    await emitAdminEvent('fare:config:invalidated', { city, vehicleType });
  }
}
