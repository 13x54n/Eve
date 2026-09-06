import { EVE_TOPICS, publishEveEvent } from "@eve/shared/kafka";

export async function publishPaymentEvent(
  type: string,
  tripId: string,
  payload: Record<string, unknown>,
) {
  await publishEveEvent(EVE_TOPICS.payment, {
    type,
    key: tripId,
    payload,
  });
}
