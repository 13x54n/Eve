import { emitPaymentEvent as emitPaymentEventKafka } from "@eve/notify";
import * as directNotify from "@eve/notify-client";
import { featureFlags } from "@eve/shared";

export async function publishPaymentEvent(
  type: string,
  tripId: string,
  payload: Record<string, unknown>,
) {
  if (featureFlags.isEnabled('USE_DIRECT_NOTIFY', tripId)) {
    await directNotify.emitPaymentEvent(tripId, type, payload);
  } else {
    await emitPaymentEventKafka(tripId, type, payload);
  }
}
