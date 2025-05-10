import { z } from "zod";

import { eventTypeAppCardZod } from "@calcom/app-store/eventTypeAppCardZod";

// Define the allowed payment options for Razorpay
export const razorpayPaymentOptions = z.enum(["ON_BOOKING"]);

// Schema for event-type-specific Razorpay settings
export const razorpayEventTypeSetupSchema = z.intersection(
  // Cast to ZodTypeAny so merge/intersection works across Zod instances
  eventTypeAppCardZod as unknown as z.ZodTypeAny,
  z.object({
    paymentOption: razorpayPaymentOptions,
    price: z.number(),
    currency: z.string(),
  })
);

// Schema for Razorpay credential keys
export const razorpayAppKeysSchema = z.object({
  key_id: z.string(),
  key_secret: z.string(),
  webhook_secret: z.string().optional(),
});

export const PaypalPaymentOptions = [
  {
    label: "on_booking_option",
    value: "ON_BOOKING",
  },
];

type PaymentOption = (typeof PaypalPaymentOptions)[number]["value"];
const VALUES: [PaymentOption, ...PaymentOption[]] = [
  PaypalPaymentOptions[0].value,
  ...PaypalPaymentOptions.slice(1).map((option) => option.value),
];
export const paymentOptionEnum = z.enum(VALUES);

export const appDataSchema = z.intersection(
  // cast to ZodTypeAny to silence the cross‐instance check
  eventTypeAppCardZod as unknown as z.ZodTypeAny,
  z.object({
    price: z.number(),
    currency: z.string(),
    paymentOption: z.string().optional(),
    enabled: z.boolean().optional(),
  })
);
export const appKeysSchema = z.object({});
