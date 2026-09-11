import { EVE_TOPICS, publishEveEvent, featureFlags } from "@eve/shared";
import * as directNotify from "@eve/notify-client";

export async function publishAuthEvent(
  type: string,
  userId: string,
  payload: Record<string, unknown>,
) {
  if (featureFlags.isEnabled('USE_DIRECT_NOTIFY', userId)) {
    await directNotify.emitAdminEvent(type, payload);
  } else {
    await publishEveEvent(EVE_TOPICS.auth, {
      type,
      key: userId,
      payload,
    });
  }
}
