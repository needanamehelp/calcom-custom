import type { AppMeta } from "@calcom/types/App";

// Re-export the metadata from config.json
import appConfig from "./config.json";

// Create app metadata with correct type
const app = {
  // Standard app metadata
  ...appConfig,
  // Make sure we use the correct type format for a payment app
  type: "qrcodepay_payment" as const,
  // This is a payment app
  variant: "payment" as const,
  // Ensure proper category
  category: "payment",
};

export default app;
