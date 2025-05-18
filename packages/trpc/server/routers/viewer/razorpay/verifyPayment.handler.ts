import { TRPCError } from "@trpc/server";

import RazorpayService from "@calcom/app-store/razorpay/lib/razorpayService";
import logger from "@calcom/lib/logger";
import prisma from "@calcom/prisma";
import type { CreateInnerContextOptions } from "@calcom/trpc/server/createContext";

import type { TVerifyPaymentInputSchema } from "./verifyPayment.schema";

type VerifyPaymentOptions = {
  ctx: {
    user: NonNullable<CreateInnerContextOptions["user"]>;
  };
  input: TVerifyPaymentInputSchema;
};

const log = logger.getSubLogger({ prefix: ["razorpay", "verify-payment"] });

export const verifyPaymentHandler = async ({ ctx, input }: VerifyPaymentOptions) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = input;
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

    // Verify the payment signature
    const isValid = razorpayService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid payment signature",
      });
    }

    // Update payment in database (if needed)
    const payment = await prisma.payment.findFirst({
      where: {
        externalId: razorpay_order_id,
      },
    });

    if (payment) {
      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          success: true,
          data: {
            ...(payment.data && typeof payment.data === 'object' ? payment.data : {}),
            razorpay_payment_id,
            razorpay_signature,
          },
        },
      });
    }

    return {
      success: true,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    };
  } catch (error) {
    log.error("Error verifying Razorpay payment:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Failed to verify Razorpay payment",
    });
  }
};

export default verifyPaymentHandler;
