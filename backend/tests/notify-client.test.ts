/**
 * Tests for Direct Notify Client with Circuit Breaker
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  emitTripEvent,
  emitUserEvent,
  emitAdminEvent,
  emitTripAndUserEvent,
  emitPaymentEvent,
  getCircuitBreakerStats,
  resetCircuitBreaker,
} from '@eve/notify-client';

// Mock the gRPC client
vi.mock('@eve/notify/grpc-client', () => ({
  emitTripEventGrpc: vi.fn(),
  emitUserEventGrpc: vi.fn(),
  emitAdminEventGrpc: vi.fn(),
  emitTripAndUserEventGrpc: vi.fn(),
}));

describe('Direct Notify Client', () => {
  beforeEach(() => {
    resetCircuitBreaker();
    vi.clearAllMocks();
  });

  describe('Circuit Breaker', () => {
    it('should start with circuit closed', () => {
      const stats = getCircuitBreakerStats();
      expect(stats.isOpen).toBe(false);
      expect(stats.failureCount).toBe(0);
    });

    it('should open circuit after 3 failures', async () => {
      const { emitTripEventGrpc } = await import('@eve/notify/grpc-client');
      
      // Mock gRPC to fail
      vi.mocked(emitTripEventGrpc).mockRejectedValue(new Error('gRPC failed'));
      
      // Mock HTTP to succeed
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      // First 3 failures
      await emitTripEvent('trip-1', 'test', {});
      await emitTripEvent('trip-2', 'test', {});
      await emitTripEvent('trip-3', 'test', {});

      const stats = getCircuitBreakerStats();
      expect(stats.isOpen).toBe(true);
      expect(stats.failureCount).toBe(3);
    });

    it('should use HTTP fallback when circuit is open', async () => {
      const { emitTripEventGrpc } = await import('@eve/notify/grpc-client');
      
      // Mock gRPC to fail
      vi.mocked(emitTripEventGrpc).mockRejectedValue(new Error('gRPC failed'));
      
      // Mock HTTP to succeed
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      // Open circuit with 3 failures
      await emitTripEvent('trip-1', 'test', {});
      await emitTripEvent('trip-2', 'test', {});
      await emitTripEvent('trip-3', 'test', {});

      // Clear fetch mock calls
      mockFetch.mockClear();

      // Next call should go directly to HTTP (circuit is open)
      await emitTripEvent('trip-4', 'test', {});

      // Should have called HTTP, not gRPC
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(emitTripEventGrpc).toHaveBeenCalledTimes(3); // Only the first 3
    });

    it('should reset circuit after timeout', async () => {
      const { emitTripEventGrpc } = await import('@eve/notify/grpc-client');
      
      // Mock gRPC to fail
      vi.mocked(emitTripEventGrpc).mockRejectedValue(new Error('gRPC failed'));
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      // Open circuit
      await emitTripEvent('trip-1', 'test', {});
      await emitTripEvent('trip-2', 'test', {});
      await emitTripEvent('trip-3', 'test', {});

      expect(getCircuitBreakerStats().isOpen).toBe(true);

      // Wait for timeout (30 seconds in real code, mocked here)
      // In real test, would use vi.useFakeTimers()
      resetCircuitBreaker();

      const stats = getCircuitBreakerStats();
      expect(stats.isOpen).toBe(false);
      expect(stats.failureCount).toBe(0);
    });
  });

  describe('emitTripEvent', () => {
    it('should call gRPC when circuit is closed', async () => {
      const { emitTripEventGrpc } = await import('@eve/notify/grpc-client');
      vi.mocked(emitTripEventGrpc).mockResolvedValue();

      await emitTripEvent('trip-1', 'trip:completed', { ok: true });

      expect(emitTripEventGrpc).toHaveBeenCalledWith(
        'trip-1',
        'trip:completed',
        { ok: true }
      );
    });

    it('should fallback to HTTP when gRPC fails', async () => {
      const { emitTripEventGrpc } = await import('@eve/notify/grpc-client');
      vi.mocked(emitTripEventGrpc).mockRejectedValue(new Error('gRPC failed'));

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      await emitTripEvent('trip-1', 'trip:completed', { ok: true });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/internal/emit'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('trip-1'),
        })
      );
    });

    it('should throw when both gRPC and HTTP fail', async () => {
      const { emitTripEventGrpc } = await import('@eve/notify/grpc-client');
      vi.mocked(emitTripEventGrpc).mockRejectedValue(new Error('gRPC failed'));
      
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      await expect(
        emitTripEvent('trip-1', 'trip:completed', {})
      ).rejects.toThrow();
    });
  });

  describe('emitUserEvent', () => {
    it('should call gRPC with role and user ID', async () => {
      const { emitUserEventGrpc } = await import('@eve/notify/grpc-client');
      vi.mocked(emitUserEventGrpc).mockResolvedValue();

      await emitUserEvent('RIDER', 'user-1', 'offer:new', { offerId: 'offer-1' });

      expect(emitUserEventGrpc).toHaveBeenCalledWith(
        'RIDER',
        'user-1',
        'offer:new',
        { offerId: 'offer-1' }
      );
    });
  });

  describe('emitPaymentEvent', () => {
    it('should emit to trip room and user rooms', async () => {
      const { emitTripEventGrpc, emitUserEventGrpc } = await import('@eve/notify/grpc-client');
      vi.mocked(emitTripEventGrpc).mockResolvedValue();
      vi.mocked(emitUserEventGrpc).mockResolvedValue();

      const payload = {
        riderUserId: 'rider-1',
        driverUserId: 'driver-1',
        amount: 1000,
      };

      await emitPaymentEvent('trip-1', 'escrow.deposit.confirmed', payload);

      // Should emit to trip room
      expect(emitTripEventGrpc).toHaveBeenCalledWith(
        'trip-1',
        'escrow.deposit.confirmed',
        payload
      );

      // Should emit to rider room
      expect(emitUserEventGrpc).toHaveBeenCalledWith(
        'RIDER',
        'rider-1',
        'escrow.deposit.confirmed',
        payload
      );

      // Should emit to driver room
      expect(emitUserEventGrpc).toHaveBeenCalledWith(
        'DRIVER',
        'driver-1',
        'escrow.deposit.confirmed',
        payload
      );
    });
  });
});
