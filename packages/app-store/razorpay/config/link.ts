import { z } from "zod";
import { eventTypeAppCardZod } from "@calcom/app-store/eventTypeAppCardZod";



export const razorpayCredentialKeysSchema = z.object({
  key_id: z.string(),
  key_secret: z.string(),
  webhook_secret: z.string().optional(),
});

/**
 * Combined schema for a Razorpay app configuration
 */
export function appEnum(isBAPPUKey = false): z.ZodTypeAny {
  return z.intersection(
    // Cast to ZodTypeAny to avoid cross-instance type conflicts
    eventTypeAppCardZod as unknown as z.ZodTypeAny,
    z.object({
      key: razorpayCredentialKeysSchema,
      appType: z.literal("razorpay"),
      paymentOption: z.enum(["ON_BOOKING"]),
      currency: z.string(),
      price: z.number(),
    })
  );
}
