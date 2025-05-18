import { TRPCError } from "@trpc/server";
import { z } from "zod";

import logger from "@calcom/lib/logger";
import prisma from "@calcom/prisma";
import type { CreateInnerContextOptions } from "@calcom/trpc/server/createContext";

import type { TMarkPaymentStatusInputSchema } from "./_router";

type MarkPaymentStatusOptions = {
  ctx: {
    user: CreateInnerContextOptions["user"];
  };
  input: TMarkPaymentStatusInputSchema;
};

const log = logger.getSubLogger({ prefix: ["qrcodepay", "mark-payment-status"] });

const markPaymentStatusHandler = async ({ ctx, input }: MarkPaymentStatusOptions) => {
  const { paymentId, status, verified } = input;
  const { user } = ctx;

  if (!user || !user.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not authenticated",
    });
  }

  try {
    // Get the payment
    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        booking: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!payment) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payment not found",
      });
    }

    // Check if the user is either the client or the host
    const isHost = payment.booking?.userId === user.id;
    
    // For verified=true, only the host can verify payments
    if (verified && !isHost) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the host can verify payments",
      });
    }

    // If status is 'paid', update the payment record
    if (status === "paid") {
      await prisma.payment.update({
        where: {
          id: paymentId,
        },
        data: {
          success: verified, // Only mark as fully successful if verified by host
          data: {
            ...(payment.data && typeof payment.data === 'object' ? payment.data : {}),
            clientClaimedPaid: true,
            verifiedByHost: verified,
            verificationDate: verified ? new Date() : null,
          },
        },
      });

      // If the payment is verified by the host, also update the booking status
      if (verified) {
        await prisma.booking.update({
          where: {
            id: payment.booking?.id,
          },
          data: {
            paid: true,
          },
        });
      }
    }

    // Return payment status
    return {
      success: true,
      paymentId: payment.id,
      status,
    };
  } catch (error) {
    log.error("Error updating payment status:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Failed to update payment status",
    });
  }
};

export default markPaymentStatusHandler;
