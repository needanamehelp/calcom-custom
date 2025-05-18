import authedProcedure from "../../../procedures/authedProcedure";
import { router } from "../../../trpc";
import { ZChargerCardInputSchema } from "./chargeCard.schema";
import { ZGetClientPaymentStatsInputSchema } from "./getClientPaymentStats.schema";

interface PaymentsRouterHandlerCache {
  chargeCard?: typeof import("./chargeCard.handler").chargeCardHandler;
  getClientPaymentStats?: typeof import("./getClientPaymentStats.handler").getClientPaymentStatsHandler;
}

const UNSTABLE_HANDLER_CACHE: PaymentsRouterHandlerCache = {};

export const paymentsRouter = router({
  chargeCard: authedProcedure.input(ZChargerCardInputSchema).mutation(async ({ ctx, input }) => {
    if (!UNSTABLE_HANDLER_CACHE.chargeCard) {
      UNSTABLE_HANDLER_CACHE.chargeCard = await import("./chargeCard.handler").then(
        (mod) => mod.chargeCardHandler
      );
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.chargeCard) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.chargeCard({
      ctx,
      input,
    });
  }),
  
  getClientPaymentStats: authedProcedure.input(ZGetClientPaymentStatsInputSchema).query(async ({ ctx, input }) => {
    if (!UNSTABLE_HANDLER_CACHE.getClientPaymentStats) {
      UNSTABLE_HANDLER_CACHE.getClientPaymentStats = await import("./getClientPaymentStats.handler").then(
        (mod) => mod.getClientPaymentStatsHandler
      );
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.getClientPaymentStats) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.getClientPaymentStats({
      ctx,
      input,
    });
  }),
});
