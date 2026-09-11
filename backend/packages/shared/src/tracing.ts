/**
 * OpenTelemetry Distributed Tracing Setup
 * 
 * Enables end-to-end request tracing across services to identify latency bottlenecks
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry tracing
 */
export function initTracing(serviceName?: string): void {
  if (sdk) {
    console.log('[tracing] Already initialized');
    return;
  }

  const service = serviceName || process.env.npm_package_name || 'eve-service';
  const version = process.env.npm_package_version || '1.0.0';
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: service,
    [ATTR_SERVICE_VERSION]: version,
  });

  const traceExporter = new OTLPTraceExporter({
    url: otlpEndpoint,
  });

  sdk = new NodeSDK({
    resource,
    spanProcessor: new BatchSpanProcessor(traceExporter),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable file system instrumentation (noisy)
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        // Enable HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        // Enable Express instrumentation
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        // Enable gRPC instrumentation
        '@opentelemetry/instrumentation-grpc': {
          enabled: true,
        },
        // Enable Prisma instrumentation
        '@opentelemetry/instrumentation-prisma': {
          enabled: true,
        },
      }),
    ],
  });

  sdk.start();
  console.log(`[tracing] OpenTelemetry initialized for ${service}`);
  console.log(`[tracing] Exporting to ${otlpEndpoint}`);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk?.shutdown()
      .then(() => console.log('[tracing] Shut down successfully'))
      .catch((error) => console.error('[tracing] Error shutting down', error))
      .finally(() => process.exit(0));
  });
}

/**
 * Shutdown tracing (for testing)
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}

/**
 * Check if tracing is enabled
 */
export function isTracingEnabled(): boolean {
  return process.env.ENABLE_TRACING === 'true';
}

/**
 * Auto-initialize if enabled
 */
if (isTracingEnabled()) {
  initTracing();
}
