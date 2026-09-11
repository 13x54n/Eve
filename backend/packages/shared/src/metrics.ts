/**
 * Prometheus Metrics for Architecture Refactoring
 * 
 * Tracks latency and errors for:
 * - Direct notify client vs Kafka
 * - Circuit breaker state
 * - Service consolidation
 */

import { Counter, Histogram, Gauge, register } from 'prom-client';

// Register default metrics (CPU, memory, etc.)
import { collectDefaultMetrics } from 'prom-client';
collectDefaultMetrics({ prefix: 'eve_' });

/**
 * Notify emit latency histogram
 */
export const notifyLatency = new Histogram({
  name: 'eve_notify_emit_duration_ms',
  help: 'Time to emit notify event',
  labelNames: ['method', 'event_type'],
  buckets: [1, 2, 5, 10, 20, 50, 100, 200, 500],
});

/**
 * Notify emit errors counter
 */
export const notifyErrors = new Counter({
  name: 'eve_notify_emit_errors_total',
  help: 'Failed notify emits',
  labelNames: ['method', 'error_type'],
});

/**
 * Circuit breaker state gauge
 */
export const circuitBreakerState = new Gauge({
  name: 'eve_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open)',
  labelNames: ['service'],
});

/**
 * Feature flag usage counter
 */
export const featureFlagUsage = new Counter({
  name: 'eve_feature_flag_usage_total',
  help: 'Feature flag evaluation count',
  labelNames: ['flag', 'enabled'],
});

/**
 * Kafka publish latency (for comparison)
 */
export const kafkaLatency = new Histogram({
  name: 'eve_kafka_publish_duration_ms',
  help: 'Time to publish to Kafka',
  labelNames: ['topic'],
  buckets: [1, 5, 10, 20, 50, 100, 200, 500],
});

/**
 * Service call latency (for consolidation tracking)
 */
export const serviceCallLatency = new Histogram({
  name: 'eve_service_call_duration_ms',
  help: 'Inter-service call latency',
  labelNames: ['from_service', 'to_service', 'method'],
  buckets: [1, 5, 10, 20, 50, 100, 200, 500],
});

/**
 * Database query latency
 */
export const dbQueryLatency = new Histogram({
  name: 'eve_db_query_duration_ms',
  help: 'Database query execution time',
  labelNames: ['operation', 'model'],
  buckets: [1, 5, 10, 20, 50, 100, 200, 500, 1000],
});

/**
 * Redis operation latency
 */
export const redisLatency = new Histogram({
  name: 'eve_redis_operation_duration_ms',
  help: 'Redis operation execution time',
  labelNames: ['operation'],
  buckets: [0.5, 1, 2, 5, 10, 20, 50],
});

/**
 * Export Prometheus metrics
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get metrics in JSON format (for debugging)
 */
export async function getMetricsJSON(): Promise<any> {
  return register.getMetricsAsJSON();
}

/**
 * Clear all metrics (for testing)
 */
export function clearMetrics(): void {
  register.clear();
}

/**
 * Timer utility for measuring latency
 */
export function startTimer(histogram: Histogram<string>) {
  return histogram.startTimer();
}

/**
 * Track notify emit with metrics
 */
export async function trackNotifyEmit<T>(
  method: 'grpc' | 'http' | 'kafka',
  eventType: string,
  fn: () => Promise<T>
): Promise<T> {
  const end = notifyLatency.startTimer({ method, event_type: eventType });
  
  try {
    const result = await fn();
    end();
    return result;
  } catch (error) {
    end();
    notifyErrors.inc({ 
      method, 
      error_type: error instanceof Error ? error.name : 'Unknown' 
    });
    throw error;
  }
}
