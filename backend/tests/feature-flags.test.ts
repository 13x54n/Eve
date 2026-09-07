/**
 * Tests for Feature Flag System
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { featureFlags, isEnabled, override, resetOverrides, getAllFlags } from '@eve/shared';

describe('Feature Flags', () => {
  beforeEach(() => {
    resetOverrides();
  });

  afterEach(() => {
    resetOverrides();
  });

  describe('isEnabled', () => {
    it('should return false when flag is disabled', () => {
      // Default state without env vars
      expect(isEnabled('USE_DIRECT_NOTIFY')).toBe(false);
    });

    it('should return true when flag is overridden', () => {
      override('USE_DIRECT_NOTIFY', { enabled: true });
      expect(isEnabled('USE_DIRECT_NOTIFY')).toBe(true);
    });

    it('should support partial rollout with identifier', () => {
      override('USE_DIRECT_NOTIFY', { enabled: true, rolloutPercentage: 50 });

      // Same identifier should always get same result
      const result1 = isEnabled('USE_DIRECT_NOTIFY', 'user-123');
      const result2 = isEnabled('USE_DIRECT_NOTIFY', 'user-123');
      expect(result1).toBe(result2);
    });

    it('should return false when rollout percentage is 0', () => {
      override('USE_DIRECT_NOTIFY', { enabled: true, rolloutPercentage: 0 });
      expect(isEnabled('USE_DIRECT_NOTIFY', 'user-123')).toBe(false);
    });

    it('should return true when rollout percentage is 100', () => {
      override('USE_DIRECT_NOTIFY', { enabled: true, rolloutPercentage: 100 });
      expect(isEnabled('USE_DIRECT_NOTIFY', 'user-123')).toBe(true);
    });
  });

  describe('override', () => {
    it('should allow runtime override of feature flags', () => {
      expect(isEnabled('USE_CONSOLIDATED_LOCATION')).toBe(false);

      override('USE_CONSOLIDATED_LOCATION', { enabled: true });

      expect(isEnabled('USE_CONSOLIDATED_LOCATION')).toBe(true);
    });
  });

  describe('resetOverrides', () => {
    it('should reset all overrides', () => {
      override('USE_DIRECT_NOTIFY', { enabled: true });
      override('USE_CONSOLIDATED_LOCATION', { enabled: true });

      expect(isEnabled('USE_DIRECT_NOTIFY')).toBe(true);
      expect(isEnabled('USE_CONSOLIDATED_LOCATION')).toBe(true);

      resetOverrides();

      expect(isEnabled('USE_DIRECT_NOTIFY')).toBe(false);
      expect(isEnabled('USE_CONSOLIDATED_LOCATION')).toBe(false);
    });
  });

  describe('getAllFlags', () => {
    it('should return all feature flag states', () => {
      const flags = getAllFlags();

      expect(flags).toHaveProperty('USE_DIRECT_NOTIFY');
      expect(flags).toHaveProperty('USE_CONSOLIDATED_LOCATION');
      expect(flags).toHaveProperty('USE_MONOLITH');
    });

    it('should reflect overrides in getAllFlags', () => {
      override('USE_DIRECT_NOTIFY', { enabled: true, rolloutPercentage: 75 });

      const flags = getAllFlags();

      expect(flags.USE_DIRECT_NOTIFY).toEqual({
        enabled: true,
        rolloutPercentage: 75,
      });
    });
  });

  describe('consistent hashing', () => {
    it('should distribute users consistently across rollout', () => {
      override('USE_DIRECT_NOTIFY', { enabled: true, rolloutPercentage: 50 });

      const results = new Map<string, boolean>();
      
      // Test 100 users
      for (let i = 0; i < 100; i++) {
        const userId = `user-${i}`;
        const enabled = isEnabled('USE_DIRECT_NOTIFY', userId);
        results.set(userId, enabled);
      }

      // Count how many are enabled
      const enabledCount = Array.from(results.values()).filter(Boolean).length;

      // Should be roughly 50% (allow 20% variance for small sample)
      expect(enabledCount).toBeGreaterThan(30);
      expect(enabledCount).toBeLessThan(70);

      // Same user should always get same result
      for (let i = 0; i < 100; i++) {
        const userId = `user-${i}`;
        const enabled = isEnabled('USE_DIRECT_NOTIFY', userId);
        expect(enabled).toBe(results.get(userId));
      }
    });
  });
});
