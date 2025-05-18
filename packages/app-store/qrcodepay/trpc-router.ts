import { TRPCError } from "@trpc/server";
import { z } from "zod";

import prisma from "@calcom/prisma";
import { router, procedure } from "@calcom/trpc/server/trpc";
import type { CreateInnerContextOptions } from "@calcom/trpc/server/createContext";

export const appRouter = router({
  createPayment: procedure
    .input(
      z.object({
        amount: z.number(),
        currency: z.string(),
        bookingId: z.number(),
        eventName: z.string().optional(),
        customerEmail: z.string().optional(),
        paymentOption: z.enum(["ON_BOOKING", "HOLD"]).default("ON_BOOKING"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      
      if (!user || !user.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }
      
      // Get the user's QRCodePay credentials
      const credentials = await prisma.credential.findFirst({
        where: {
          userId: user.id,
          type: "qrcodepay_payment",
        },
        select: {
          key: true,
        },
      });
      
      if (!credentials) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "QR Code Payment not set up correctly",
        });
      }
      
      const credentialKey = credentials.key as Record<string, unknown>;
      
      // Create a new payment record
      const payment = await prisma.payment.create({
        data: {
          amount: input.amount,
          currency: input.currency,
          bookingId: input.bookingId, // Add bookingId as required by Prisma schema
          fee: 0, // No processing fee
          refunded: false,
          success: false, // Initially not successful until verified
          externalId: `qrcode_${Date.now()}_${user.id}`,
          uid: `qrcode_${Date.now()}_${user.id}`,
          appId: "qrcodepay",
          data: {
            type: "qrcodepay_payment",
            qrCodeUrl: credentialKey.qrCodeUrl,
            accountName: credentialKey.accountName,
            upiId: credentialKey.upiId,
            instructions: credentialKey.instructions,
            clientClaimedPaid: false,
            verifiedByHost: false,
            eventName: input.eventName,
            customerEmail: input.customerEmail,
            paymentOption: input.paymentOption,
          }
        },
      });
      
      return payment;
    }),
  markPaymentStatus: procedure
    .input(
      z.object({
        paymentId: z.number(),
        verified: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }: { 
      ctx: { user: CreateInnerContextOptions["user"] },
      input: { paymentId: number, verified: boolean }
    }) => {
      const { user } = ctx;
      const { paymentId, verified } = input;
      
      if (!user || !user.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }
      
      // Find the payment
      const payment = await prisma.payment.findUnique({
        where: {
          id: paymentId,
        },
        include: {
          booking: true,
        },
      });
      
      if (!payment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment not found",
        });
      }
      
      // Check if the user is the host (for verification)
      const isHost = payment.booking?.userId === user.id;
      if (verified && !isHost) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the host can verify payments",
        });
      }
      
      // Extract the payment data as an object we can spread
      const paymentData = payment.data as Record<string, unknown>;
      
      // Update the payment
      await prisma.payment.update({
        where: {
          id: paymentId,
        },
        data: {
          success: verified, // Only mark as fully successful if verified by host
          data: {
            ...paymentData,
            clientClaimedPaid: true,
            verifiedByHost: verified,
            verificationDate: verified ? new Date() : null,
          },
        },
      });
      
      // If verified by host, also update the booking as paid
      if (verified && payment.booking) {
        await prisma.booking.update({
          where: {
            id: payment.booking.id,
          },
          data: {
            paid: true,
          },
        });
      }
      
      return {
        success: true,
        paymentId,
      };
    }),
});

export type AppRouter = typeof appRouter;
