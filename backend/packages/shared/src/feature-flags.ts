/**
 * Feature Flag System
 * 
 * Enables gradual rollout of architectural changes with instant rollback capability
 */

export type FeatureFlag = 
  | 'USE_DIRECT_NOTIFY'          // Route notify events via direct calls vs Kafka
  | 'USE_CONSOLIDATED_LOCATION'   // Use merged location service  
  | 'USE_MONOLITH';               // Use monolith vs microservices

/**
 * Feature flag configuration
 */
interface FeatureFlagConfig {
  enabled: boolean;
  rolloutPercentage?: number; // 0-100, for gradual rollout
}

/**
 * Default feature flag states
 */
const DEFAULT_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
  USE_DIRECT_NOTIFY: {
    enabled: process.env.USE_DIRECT_NOTIFY === 'true',
    rolloutPercentage: parseInt(process.env.DIRECT_NOTIFY_ROLLOUT || '100', 10),
  },
  USE_CONSOLIDATED_LOCATION: {
    enabled: process.env.USE_CONSOLIDATED_LOCATION === 'true',
    rolloutPercentage: parseInt(process.env.CONSOLIDATED_LOCATION_ROLLOUT || '100', 10),
  },
  USE_MONOLITH: {
    enabled: process.env.USE_MONOLITH === 'true',
    rolloutPercentage: 100, // Monolith is all-or-nothing
  },
};

/**
 * Runtime feature flag overrides (for testing)
 */
const runtimeOverrides: Partial<Record<FeatureFlag, FeatureFlagConfig>> = {};

/**
 * Check if a feature flag is enabled
 */
export function isEnabled(flag: FeatureFlag, identifier?: string): boolean {
  const config = runtimeOverrides[flag] || DEFAULT_FLAGS[flag];
  
  if (!config.enabled) {
    return false;
  }

  // If full rollout, return true
  if (config.rolloutPercentage === undefined || config.rolloutPercentage >= 100) {
    return true;
  }

  // For partial rollout, use identifier for consistent hashing
  if (identifier) {
    const hash = simpleHash(identifier);
    return (hash % 100) < config.rolloutPercentage;
  }

  // No identifier provided, use random (not recommended for prod)
  return Math.random() * 100 < config.rolloutPercentage;
}

/**
 * Simple hash function for consistent rollout
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Override a feature flag (for testing)
 */
export function override(flag: FeatureFlag, config: FeatureFlagConfig): void {
  runtimeOverrides[flag] = config;
}

/**
 * Reset all overrides (for testing)
 */
export function resetOverrides(): void {
  Object.keys(runtimeOverrides).forEach(key => {
    delete runtimeOverrides[key as FeatureFlag];
  });
}

/**
 * Get current feature flag states (for debugging)
 */
export function getAllFlags(): Record<FeatureFlag, FeatureFlagConfig> {
  return {
    USE_DIRECT_NOTIFY: runtimeOverrides.USE_DIRECT_NOTIFY || DEFAULT_FLAGS.USE_DIRECT_NOTIFY,
    USE_CONSOLIDATED_LOCATION: runtimeOverrides.USE_CONSOLIDATED_LOCATION || DEFAULT_FLAGS.USE_CONSOLIDATED_LOCATION,
    USE_MONOLITH: runtimeOverrides.USE_MONOLITH || DEFAULT_FLAGS.USE_MONOLITH,
  };
}

/**
 * Feature flags service (singleton)
 */
export const featureFlags = {
  isEnabled,
  override,
  resetOverrides,
  getAllFlags,
};
