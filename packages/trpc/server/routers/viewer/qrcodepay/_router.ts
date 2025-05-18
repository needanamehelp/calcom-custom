import { z } from "zod";

import type { CreateInnerContextOptions } from "@calcom/trpc/server/createContext";
import { router } from "../../../trpc";
import authedProcedure from "../../../procedures/authedProcedure";
import markPaymentStatusHandler from "./markPaymentStatus.handler";

const markPaymentStatusSchema = z.object({
  paymentId: z.number(),
  status: z.enum(["paid", "pending", "failed"]),
  verified: z.boolean().default(false),
});

export type TMarkPaymentStatusInputSchema = z.infer<typeof markPaymentStatusSchema>;

export const qrcodepayRouter = router({
  markPaymentStatus: authedProcedure
    .input(markPaymentStatusSchema)
    .mutation(async ({ ctx, input }: { ctx: any; input: TMarkPaymentStatusInputSchema }) => {
      // Type assertion to match the expected handler parameter type
      return markPaymentStatusHandler({
        ctx: { user: ctx.user as any },
        input,
      });
    }),
});
