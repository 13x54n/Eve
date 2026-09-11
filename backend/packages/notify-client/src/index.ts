/**
 * Direct Notify Client - Replaces Kafka for notify events
 * 
 * Features:
 * - Circuit breaker pattern for reliability
 * - gRPC primary, HTTP fallback
 * - Zero data loss (immediate delivery)
 * - Maintains same API as Kafka-based approach
 */

import { 
  emitTripEventGrpc, 
  emitUserEventGrpc, 
  emitAdminEventGrpc, 
  emitTripAndUserEventGrpc 
} from "@eve/notify/grpc-client";

const NOTIFY_URL = process.env.NOTIFY_URL || 'http://localhost:4004';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';

// Circuit breaker state
let failureCount = 0;
let lastFailureTime = 0;
const FAILURE_THRESHOLD = 3;
const RESET_TIMEOUT = 30000; // 30 seconds

/**
 * HTTP emit body structure
 */
type HttpEmitBody = {
  target: 'trip' | 'user' | 'admin' | 'trip_and_user';
  event: string;
  payload: unknown;
  tripId?: string;
  role?: 'RIDER' | 'DRIVER';
  userId?: string;
};

/**
 * Emit event via HTTP fallback
 */
async function emitViaHttp(body: HttpEmitBody): Promise<void> {
  const res = await fetch(`${NOTIFY_URL}/internal/emit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_SECRET,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HTTP emit failed: ${res.status}`);
  }
}

/**
 * Check if circuit breaker should allow gRPC attempt
 */
function shouldUseGrpc(): boolean {
  const now = Date.now();
  
  // Reset circuit breaker after timeout
  if (now - lastFailureTime > RESET_TIMEOUT) {
    failureCount = 0;
  }
  
  return failureCount < FAILURE_THRESHOLD;
}

/**
 * Record gRPC failure
 */
function recordFailure(): void {
  failureCount++;
  lastFailureTime = Date.now();
  
  if (failureCount === FAILURE_THRESHOLD) {
    console.warn(
      `[notify-client] Circuit breaker OPEN after ${FAILURE_THRESHOLD} failures. ` +
      `Using HTTP fallback for ${RESET_TIMEOUT}ms.`
    );
  }
}

/**
 * Record gRPC success
 */
function recordSuccess(): void {
  if (failureCount > 0) {
    console.log('[notify-client] gRPC recovered, resetting circuit breaker');
    failureCount = 0;
  }
}

/**
 * Execute with circuit breaker and fallback
 */
async function executeWithFallback(
  grpcFn: () => Promise<void>,
  httpBody: HttpEmitBody
): Promise<void> {
  // Try gRPC if circuit is closed
  if (shouldUseGrpc()) {
    try {
      await grpcFn();
      recordSuccess();
      return;
    } catch (error) {
      recordFailure();
      console.warn('[notify-client] gRPC failed, falling back to HTTP:', error);
    }
  }

  // Fallback to HTTP
  try {
    await emitViaHttp(httpBody);
  } catch (httpError) {
    console.error(
      '[notify-client] Both gRPC and HTTP failed:',
      httpError instanceof Error ? httpError.message : httpError
    );
    throw httpError;
  }
}

/**
 * Emit trip event
 */
export async function emitTripEvent(
  tripId: string, 
  event: string, 
  payload: unknown
): Promise<void> {
  await executeWithFallback(
    () => emitTripEventGrpc(tripId, event, payload),
    { target: 'trip', tripId, event, payload }
  );
}

/**
 * Emit user event
 */
export async function emitUserEvent(
  role: 'RIDER' | 'DRIVER',
  userId: string,
  event: string,
  payload: unknown
): Promise<void> {
  await executeWithFallback(
    () => emitUserEventGrpc(role, userId, event, payload),
    { target: 'user', role, userId, event, payload }
  );
}

/**
 * Emit trip and user event (union emit)
 */
export async function emitTripAndUserEvent(
  tripId: string,
  role: 'RIDER' | 'DRIVER',
  userId: string,
  event: string,
  payload: unknown
): Promise<void> {
  await executeWithFallback(
    () => emitTripAndUserEventGrpc(tripId, role, userId, event, payload),
    { target: 'trip_and_user', tripId, role, userId, event, payload }
  );
}

/**
 * Emit admin event
 */
export async function emitAdminEvent(
  event: string,
  payload: unknown
): Promise<void> {
  await executeWithFallback(
    () => emitAdminEventGrpc(event, payload),
    { target: 'admin', event, payload }
  );
}

/**
 * Emit payment event (sends to trip room + user rooms)
 */
export async function emitPaymentEvent(
  tripId: string,
  event: string,
  payload: unknown
): Promise<void> {
  // Payment events go to trip room first
  await emitTripEvent(tripId, event, payload);
  
  // Extract user IDs from payload and emit to their rooms
  const body = payload && typeof payload === 'object' ? payload as {
    riderUserId?: string | null;
    driverUserId?: string | null;
  } : {};

  if (body.riderUserId) {
    await emitUserEvent('RIDER', body.riderUserId, event, payload);
  }
  
  if (body.driverUserId) {
    await emitUserEvent('DRIVER', body.driverUserId, event, payload);
  }
}

/**
 * Get circuit breaker stats (for monitoring)
 */
export function getCircuitBreakerStats() {
  return {
    failureCount,
    isOpen: failureCount >= FAILURE_THRESHOLD,
    lastFailureTime,
  };
}

/**
 * Reset circuit breaker (for testing)
 */
export function resetCircuitBreaker() {
  failureCount = 0;
  lastFailureTime = 0;
}
