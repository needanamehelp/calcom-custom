import { TRPCError } from "@trpc/server";

import RazorpayService from "@calcom/app-store/razorpay/lib/razorpayService";
import logger from "@calcom/lib/logger";
import type { CreateInnerContextOptions } from "@calcom/trpc/server/createContext";

import type { TCreateOrderInputSchema } from "./createOrder.schema";

type CreateOrderOptions = {
  ctx: {
    user: NonNullable<CreateInnerContextOptions["user"]>;
  };
  input: TCreateOrderInputSchema;
};

const log = logger.getSubLogger({ prefix: ["razorpay", "create-order"] });

export const createOrderHandler = async ({ ctx, input }: CreateOrderOptions) => {
  const { amount, currency, notes } = input;
  const { user } = ctx;
  
  if (!user || !user.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not authenticated",
    });
  }

  try {
    // Get Razorpay credentials for the user
    const razorpayService = new RazorpayService();
    const credentials = await razorpayService.getUserCredentials(user.id);

    if (!credentials) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No Razorpay credentials found. Please set up Razorpay first.",
      });
    }

    // Initialize Razorpay with the credentials
    razorpayService.setCredentials(credentials);

    // Create a receipt ID
    const receipt = `receipt_${Date.now()}_${user.id}`;

    // Create the order
    const order = await razorpayService.createOrder(
      amount,
      currency,
      receipt,
      { ...notes, userId: user.id.toString() }
    );

    return {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    };
  } catch (error) {
    log.error("Error creating Razorpay order:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR", 
      message: error instanceof Error ? error.message : "Failed to create Razorpay order",
    });
  }
};

export default createOrderHandler;
