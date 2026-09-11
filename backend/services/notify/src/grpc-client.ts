import { createGrpcClient, loadProto, promisifyUnaryCall } from '@eve/grpc';

// Load proto definition
const proto = loadProto('backend/proto/notify.proto', 'eve.notify');
const NotifyService = proto.NotifyService;

let client: any = null;

/**
 * Get or create gRPC client for Notify Service
 */
function getClient() {
  if (client) return client;
  
  const url = process.env.NOTIFY_GRPC_URL || '127.0.0.1:50052';
  
  client = createGrpcClient(
    NotifyService,
    { url },
  );
  
  console.log(`Notify gRPC client connected to ${url}`);
  return client;
}

/**
 * Emit trip event via gRPC
 */
export async function emitTripEventGrpc(
  tripId: string, 
  event: string, 
  payload: unknown
): Promise<void> {
  const client = getClient();
  
  await promisifyUnaryCall(
    client,
    'EmitTripEvent',
    {
      trip_id: tripId,
      event,
      payload: JSON.stringify(payload),
    }
  );
}

/**
 * Emit user event via gRPC
 */
export async function emitUserEventGrpc(
  role: "RIDER" | "DRIVER",
  userId: string,
  event: string,
  payload: unknown
): Promise<void> {
  const client = getClient();
  
  await promisifyUnaryCall(
    client,
    'EmitUserEvent',
    {
      role,
      user_id: userId,
      event,
      payload: JSON.stringify(payload),
    }
  );
}

/**
 * Emit admin event via gRPC
 */
export async function emitAdminEventGrpc(
  event: string,
  payload: unknown
): Promise<void> {
  const client = getClient();
  
  await promisifyUnaryCall(
    client,
    'EmitAdminEvent',
    {
      event,
      payload: JSON.stringify(payload),
    }
  );
}

/**
 * Emit trip and user event via gRPC
 */
export async function emitTripAndUserEventGrpc(
  tripId: string,
  role: "RIDER" | "DRIVER",
  userId: string,
  event: string,
  payload: unknown
): Promise<void> {
  const client = getClient();
  
  await promisifyUnaryCall(
    client,
    'EmitTripAndUserEvent',
    {
      trip_id: tripId,
      role,
      user_id: userId,
      event,
      payload: JSON.stringify(payload),
    }
  );
}

/**
 * Close gRPC client connection
 */
export function closeNotifyGrpcClient(): void {
  if (client) {
    client.close();
    client = null;
    console.log('Notify gRPC client closed');
  }
}
