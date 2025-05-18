import { z } from "zod";

export const ZGetClientPaymentStatsInputSchema = z.object({
  clientId: z.string(),
  isGuest: z.boolean().default(false),
});

export type TGetClientPaymentStatsInputSchema = z.infer<typeof ZGetClientPaymentStatsInputSchema>;
