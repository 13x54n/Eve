let activeChatTripId: string | null = null;

export function setActiveChatTripId(tripId: string | null) {
  activeChatTripId = tripId;
}

export function getActiveChatTripId() {
  return activeChatTripId;
}
