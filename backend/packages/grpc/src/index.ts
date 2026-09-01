import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, isAbsolute, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface GrpcServerConfig {
  port: number;
  credentials?: grpc.ServerCredentials;
}

export interface GrpcClientConfig {
  url: string;
  credentials?: grpc.ChannelCredentials;
}

/**
 * gRPC Server wrapper for Eve services
 */
export class GrpcServer {
  private server: grpc.Server;
  private services: Map<string, any> = new Map();
  boundPort = 0;

  constructor() {
    this.server = new grpc.Server({
      'grpc.max_receive_message_length': 1024 * 1024 * 10, // 10MB
      'grpc.max_send_message_length': 1024 * 1024 * 10,
    });
  }

  /**
   * Add a service implementation to the server
   */
  addService(definition: grpc.ServiceDefinition, implementation: any) {
    this.server.addService(definition, implementation);
    this.services.set(definition.toString(), implementation);
  }

  /**
   * Start the gRPC server. Port 0 binds an ephemeral port; the assigned port is
   * stored on `boundPort` and returned.
   */
  async start(config: GrpcServerConfig): Promise<number> {
    const creds = config.credentials || grpc.ServerCredentials.createInsecure();
    
    return new Promise<number>((resolve, reject) => {
      this.server.bindAsync(
        `0.0.0.0:${config.port}`,
        creds,
        (error, port) => {
          if (error) {
            console.error('Failed to start gRPC server:', error);
            reject(error);
          } else {
            this.boundPort = port;
            this.server.start();
            console.log(`✓ gRPC server listening on port ${port}`);
            resolve(port);
          }
        }
      );
    });
  }

  /**
   * Gracefully shutdown the server
   */
  async shutdown(): Promise<void> {
    return new Promise<void>((resolve) => {
      console.log('Shutting down gRPC server...');
      this.server.tryShutdown(() => {
        console.log('✓ gRPC server shut down gracefully');
        resolve();
      });
    });
  }

  /**
   * Force shutdown the server
   */
  forceShutdown(): void {
    this.server.forceShutdown();
  }
}

/**
 * Resolve a proto file from source (Vitest/tsx) or compiled dist layouts.
 */
export function resolveProtoPath(protoPath: string): string {
  if (isAbsolute(protoPath)) {
    if (existsSync(protoPath)) return protoPath;
    throw new Error(`Proto file not found: ${protoPath}`);
  }

  const withoutBackendPrefix = protoPath.replace(/^backend[\\/]/, '');
  const candidates = [
    join(process.cwd(), protoPath),
    join(process.cwd(), withoutBackendPrefix),
    join(__dirname, '../../../', protoPath),
    join(__dirname, '../../../', withoutBackendPrefix),
    join(__dirname, '../../../../', protoPath),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(`Proto file not found: ${protoPath}. Tried:\n${candidates.join('\n')}`);
}

/**
 * Load protocol buffer definition
 */
export function loadProto(protoPath: string, packageName?: string): any {
  const resolvedPath = resolveProtoPath(protoPath);

  const packageDefinition = protoLoader.loadSync(resolvedPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const packageDef = grpc.loadPackageDefinition(packageDefinition);
  
  if (packageName) {
    return getNestedPackage(packageDef, packageName);
  }
  
  return packageDef;
}

/**
 * Helper to get nested package
 */
function getNestedPackage(packageDef: any, packageName: string): any {
  const parts = packageName.split('.');
  let current = packageDef;
  
  for (const part of parts) {
    if (!current[part]) {
      throw new Error(`Package ${packageName} not found in proto definition`);
    }
    current = current[part];
  }
  
  return current;
}

/**
 * Create gRPC client with connection pooling
 */
export function createGrpcClient<T>(
  serviceConstructor: new (address: string, credentials: grpc.ChannelCredentials, options?: any) => T,
  config: GrpcClientConfig
): T {
  const creds = config.credentials || grpc.credentials.createInsecure();
  
  const options = {
    'grpc.max_receive_message_length': 1024 * 1024 * 10, // 10MB
    'grpc.max_send_message_length': 1024 * 1024 * 10,
    'grpc.keepalive_time_ms': 30000,
    'grpc.keepalive_timeout_ms': 10000,
    'grpc.keepalive_permit_without_calls': 1,
    'grpc.http2.max_pings_without_data': 0,
  };

  return new serviceConstructor(config.url, creds, options);
}

/**
 * Create interceptor for logging
 */
export function createLoggingInterceptor(serviceName: string) {
  return (options: any, nextCall: any) => {
    return new grpc.InterceptingCall(nextCall(options), {
      start: (metadata: any, listener: any, next: any) => {
        const method = options.method_definition.path;
        const start = Date.now();
        
        console.log(`[gRPC] ${serviceName} - Calling: ${method}`);
        
        next(metadata, {
          ...listener,
          onReceiveStatus: (status: grpc.StatusObject, next: any) => {
            const duration = Date.now() - start;
            const level = status.code === grpc.status.OK ? 'info' : 'error';
            
            console.log(
              `[gRPC] ${serviceName} - ${method} completed in ${duration}ms with status: ${status.code}`
            );
            
            if (status.code !== grpc.status.OK) {
              console.error(`[gRPC] ${serviceName} - Error: ${status.details}`);
            }
            
            next(status);
          },
        });
      },
    });
  };
}

/**
 * Create interceptor for error handling
 */
export function createErrorInterceptor() {
  return (options: any, nextCall: any) => {
    return new grpc.InterceptingCall(nextCall(options), {
      start: (metadata: any, listener: any, next: any) => {
        next(metadata, {
          ...listener,
          onReceiveStatus: (status: grpc.StatusObject, next: any) => {
            if (status.code !== grpc.status.OK) {
              // Log error for monitoring
              console.error('[gRPC] Error intercepted:', {
                code: status.code,
                message: status.details,
                metadata: status.metadata,
              });
            }
            next(status);
          },
        });
      },
    });
  };
}

/**
 * Promisify unary gRPC call
 */
export function promisifyUnaryCall<TRequest, TResponse>(
  client: any,
  method: string,
  request: TRequest
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    client[method](request, (error: grpc.ServiceError | null, response: TResponse) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * gRPC error codes
 */
export const GrpcStatus = grpc.status;

/**
 * gRPC credentials
 */
export const credentials = grpc.credentials;
export const ServerCredentials = grpc.ServerCredentials;

// Export types
export type { ServiceError } from '@grpc/grpc-js';
export type GrpcStatusCode = grpc.status;
