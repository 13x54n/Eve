import "dotenv/config";
import { createPaymentApp } from "./app.js";

const port = Number(process.env.PAYMENT_PORT || 4006);
createPaymentApp().listen(port, "0.0.0.0", () => {
  console.log(`Payment service running on port ${port}`);
});
