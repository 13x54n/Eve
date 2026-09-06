import { emitPaymentEvent } from "@eve/notify";

export async function publishPaymentEvent(
  type: string,
  tripId: string,
  payload: Record<string, unknown>,
) {
  await emitPaymentEvent(tripId, type, payload);
}
