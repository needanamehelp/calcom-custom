import { z } from "zod";

export const ZVerifyPaymentInputSchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string()
});

export type TVerifyPaymentInputSchema = z.infer<typeof ZVerifyPaymentInputSchema>;
