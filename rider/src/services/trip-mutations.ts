import { actionQueue } from "@/lib/action-queue";
import { cancelTrip, Trip } from "./trips";

export function registerTripMutationHandlers() {
  actionQueue.registerHandler("rider:cancelTrip", async (payload) => {
    const { tripId } = payload as { tripId: string };
    await cancelTrip(tripId);
    console.log(`[TripMutations] Cancelled trip ${tripId}`);
  });

  actionQueue.registerHandler("rider:acceptOffer", async (payload) => {
    const { offerId } = payload as { offerId: string };
    console.log(`[TripMutations] Accepted offer ${offerId}`);
  });
}

export async function queueTripMutation(
  action: string,
  payload: unknown,
  options?: { maxRetries?: number; expiryMs?: number }
): Promise<string> {
  return actionQueue.enqueue(action, payload, options);
}
