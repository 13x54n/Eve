/**
 * Auth Module Events
 * 
 * Publishes authentication events to notify service
 */

import { featureFlags } from '@eve/shared';
import * as directNotify from '@eve/notify-client';

export async function publishAuthEvent(
  type: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (featureFlags.isEnabled('USE_DIRECT_NOTIFY', userId)) {
    await directNotify.emitAdminEvent(type, payload);
  } else {
    // Fallback to Kafka if not using direct notify
    const { publishEveEvent, EVE_TOPICS } = await import('@eve/shared');
    await publishEveEvent(EVE_TOPICS.auth, {
      type,
      key: userId,
      payload,
    });
  }
}
