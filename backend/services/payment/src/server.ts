import "dotenv/config";
import { createPaymentApp } from "./app.js";
import { rehydrateEscrowFinalizeTimers } from "./escrow-scheduler.js";
import { startEscrowEventWatch } from "./escrow-watch.js";
import { startPaymentKafkaConsumers } from "./kafka-consumer.js";

const port = Number(process.env.PAYMENT_PORT || 4006);
createPaymentApp().listen(port, "0.0.0.0", () => {
  console.log(`Payment service running on port ${port}`);
  startEscrowEventWatch();
  void rehydrateEscrowFinalizeTimers();
  void startPaymentKafkaConsumers();
});
