import { z } from "zod";

export const ZCreateOrderInputSchema = z.object({
  amount: z.number().min(1),
  currency: z.string().default('INR'),
  notes: z.record(z.string()).optional()
});

export type TCreateOrderInputSchema = z.infer<typeof ZCreateOrderInputSchema>;
