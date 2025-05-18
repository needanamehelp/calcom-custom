import { z } from "zod";

import type { CreateInnerContextOptions } from "@calcom/trpc/server/createContext";
import authedProcedure from "../../../procedures/authedProcedure";
import { router } from "../../../trpc";
import { ZCreateOrderInputSchema } from "./createOrder.schema";
import { ZVerifyPaymentInputSchema } from "./verifyPayment.schema";

interface RazorpayRouterHandlerCache {
  createOrder?: typeof import("./createOrder.handler").createOrderHandler;
  verifyPayment?: typeof import("./verifyPayment.handler").verifyPaymentHandler;
}

const UNSTABLE_HANDLER_CACHE: RazorpayRouterHandlerCache = {};

// Create the router
export const razorpayRouter = router({
  // Create a new Razorpay order
  createOrder: authedProcedure
    .input(ZCreateOrderInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!UNSTABLE_HANDLER_CACHE.createOrder) {
        UNSTABLE_HANDLER_CACHE.createOrder = await import("./createOrder.handler").then(
          (mod) => mod.createOrderHandler
        );
      }

      // Unreachable code but required for type safety
      if (!UNSTABLE_HANDLER_CACHE.createOrder) {
        throw new Error("Failed to load handler");
      }

      // Use the proper typing for context as per Cal.com codebase conventions
      // CreateInnerContextOptions["user"] is the correct type for user
      // Type assertion to match the expected handler parameter type
      return UNSTABLE_HANDLER_CACHE.createOrder({
        ctx: { user: ctx.user as any },
        input,
      });
    }),

  // Verify a Razorpay payment
  verifyPayment: authedProcedure
    .input(ZVerifyPaymentInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!UNSTABLE_HANDLER_CACHE.verifyPayment) {
        UNSTABLE_HANDLER_CACHE.verifyPayment = await import("./verifyPayment.handler").then(
          (mod) => mod.verifyPaymentHandler
        );
      }

      // Unreachable code but required for type safety
      if (!UNSTABLE_HANDLER_CACHE.verifyPayment) {
        throw new Error("Failed to load handler");
      }

      // Use the proper typing for context as per Cal.com codebase conventions
      // CreateInnerContextOptions["user"] is the correct type for user
      // Type assertion to match the expected handler parameter type
      return UNSTABLE_HANDLER_CACHE.verifyPayment({
        ctx: { user: ctx.user as any },
        input,
      });
    }),
});
