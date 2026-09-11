import { actionQueue } from "@/lib/action-queue";
import { acceptDispatch, declineDispatch, arrivedAtPickup, startTrip, completeTrip, cancelTrip } from "./driver";

export function registerTripMutationHandlers() {
  actionQueue.registerHandler("driver:acceptDispatch", async (payload) => {
    const { tripId, proposedFare } = payload as { tripId: string; proposedFare?: number };
    await acceptDispatch(tripId, proposedFare);
    console.log(`[TripMutations] Accepted dispatch for trip ${tripId}`);
  });

  actionQueue.registerHandler("driver:declineDispatch", async (payload) => {
    const { tripId } = payload as { tripId: string };
    await declineDispatch(tripId);
    console.log(`[TripMutations] Declined dispatch for trip ${tripId}`);
  });

  actionQueue.registerHandler("driver:arrivedAtPickup", async (payload) => {
    const { tripId } = payload as { tripId: string };
    await arrivedAtPickup(tripId);
    console.log(`[TripMutations] Marked arrived at pickup for trip ${tripId}`);
  });

  actionQueue.registerHandler("driver:startTrip", async (payload) => {
    const { tripId } = payload as { tripId: string };
    await startTrip(tripId);
    console.log(`[TripMutations] Started trip ${tripId}`);
  });

  actionQueue.registerHandler("driver:completeTrip", async (payload) => {
    const { tripId, rating, feedback } = payload as {
      tripId: string;
      rating?: number;
      feedback?: string;
    };
    await completeTrip(tripId, { rating, feedback });
    console.log(`[TripMutations] Completed trip ${tripId}`);
  });

  actionQueue.registerHandler("driver:cancelTrip", async (payload) => {
    const { tripId, reason } = payload as { tripId: string; reason?: string };
    await cancelTrip(tripId, reason);
    console.log(`[TripMutations] Cancelled trip ${tripId}`);
  });
}

export async function queueTripMutation(
  action: string,
  payload: unknown,
  options?: { maxRetries?: number; expiryMs?: number }
): Promise<string> {
  return actionQueue.enqueue(action, payload, options);
}
