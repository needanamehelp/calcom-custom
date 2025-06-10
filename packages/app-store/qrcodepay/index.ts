export * as api from "./api";
export * as lib from "./lib";
export { metadata } from "./_metadata";

// Export BookingPaymentComponent for use in the booking flow
export { default as BookingPaymentComponent } from "./components/BookingPaymentComponent";

// Export specific payment components for integration
export { createPaymentLink } from "./lib/createPaymentLink";
export { handlePayment } from "./lib/handlePayment";

// Export app settings with isSetupAlready flag
import app from "./app";
export const appSettings = {
  ...app,
  isSetupAlready: true
};

// Add default export for Cal.com to recognize properly
export default appSettings;
