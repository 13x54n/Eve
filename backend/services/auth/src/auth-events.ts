import { EVE_TOPICS, publishEveEvent } from "@eve/shared/kafka";

export async function publishAuthEvent(
  type: string,
  userId: string,
  payload: Record<string, unknown>,
) {
  await publishEveEvent(EVE_TOPICS.auth, {
    type,
    key: userId,
    payload,
  });
}
