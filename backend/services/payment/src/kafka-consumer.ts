import { EVE_TOPICS, eventInstance, isKafkaEnabled, subscribeEveTopic, type EveEvent } from "@eve/shared/kafka";
import { cancelEscrowFinalize, scheduleEscrowFinalize } from "./escrow-scheduler.js";

export async function handlePaymentEvent(event: EveEvent) {
  if (event.instance === eventInstance()) return;
  const payload = (event.payload ?? {}) as {
    settleFromMs?: number;
    txHash?: string | null;
  };
  if (event.type === "escrow.deposit.confirmed") {
    const { applyChainDeposit } = await import("./payment.service.js");
    await applyChainDeposit(event.key, payload.txHash ?? "");
    return;
  }
  if (event.type === "escrow.settlement.started") {
    if (payload.txHash) {
      const { applyChainSettlement } = await import("./payment.service.js");
      await applyChainSettlement(event.key, payload.txHash, payload.settleFromMs);
    } else {
      await scheduleEscrowFinalize(event.key, payload.settleFromMs ?? Date.now());
    }
    return;
  }
  if (event.type === "escrow.disputed") {
    const { onEscrowDisputed } = await import("./payment.service.js");
    await onEscrowDisputed(event.key, payload.txHash ?? null);
    return;
  }
  if (event.type === "escrow.released") {
    cancelEscrowFinalize(event.key);
    const { applyChainRelease } = await import("./payment.service.js");
    await applyChainRelease(event.key, payload.txHash ?? "");
    return;
  }
  if (event.type === "escrow.refunded") {
    cancelEscrowFinalize(event.key);
    const { applyChainRefund } = await import("./payment.service.js");
    await applyChainRefund(event.key, payload.txHash ?? "");
  }
}

export async function startPaymentKafkaConsumers() {
  if (!isKafkaEnabled()) return;
  await subscribeEveTopic({
    groupId: "eve-payment",
    topic: EVE_TOPICS.payment,
    handler: handlePaymentEvent,
  });
  console.log("Payment Kafka consumer subscribed");
}
