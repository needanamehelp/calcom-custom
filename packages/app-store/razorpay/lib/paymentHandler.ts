import type { Booking, Payment, Prisma } from "@prisma/client";
import type { z } from "zod";

import prisma from "@calcom/prisma";
import { handlePaymentSuccess } from "@calcom/lib/payment/handlePaymentSuccess";
import logger from "@calcom/lib/logger";
import { BookingStatus } from "@calcom/prisma/enums";
import type { CalendarEvent } from "@calcom/types/Calendar";
import type { EventTypeAppsList } from "@calcom/app-store/utils";

import RazorpayService from "./razorpayService";
import { convertFromSmallestToPresentableCurrencyUnit } from "./currencyConversions";

const log = logger.getSubLogger({ prefix: ["razorpay", "paymentHandler"] });

export interface PaymentOptions {
  payment: Payment;
  bookingId: number;
  bookerEmail: string;
  paymentOption: string;
  eventTitle?: string;
}

export interface PaymentHandlerOptions {
  booking: {
    id: number;
    uid: string;
    startTime: Date;
    payment: Payment | null;
    eventTypeId: number | null;
    eventType: {
      title: string;
    } | null;
    attendees: {
      email: string;
      name: string;
    }[];
  };
  user: {
    id: number;
    email: string;
    name: string;
  };
  eventType: {
    metadata: { apps?: Record<string, unknown> } | null;
    title: string;
  };
  calEvent: CalendarEvent;
}

export const razorpayPaymentHandler = {
  id: "razorpay",

  async create(options: PaymentHandlerOptions) {
    const { booking, user, eventType } = options;
    const metadata = eventType.metadata?.apps?.razorpay as {
      enabled: boolean;
      price: number;
      currency: string;
      paymentOption: string;
    };

    if (!metadata || !metadata.enabled) {
      throw new Error("Razorpay payment app is not enabled");
    }

    const attendee = booking.attendees[0] || { email: "", name: "" };

    try {
      // Get credentials for the user
      const razorpayService = new RazorpayService();
      const credentials = await razorpayService.getUserCredentials(user.id);

      if (!credentials || !credentials.key_id || !credentials.key_secret) {
        throw new Error("No Razorpay credentials found");
      }

      razorpayService.setCredentials(credentials);

      // Create payment record
      const payment = await razorpayService.createPaymentForBooking(
        // Pass only the fields that are needed by createPaymentForBooking
        { id: booking.id } as unknown as Booking,
        metadata.price,
        metadata.currency
      );

      // Update booking with payment
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.PENDING,
          paid: false,
          payment: {
            connect: {
              id: payment.id,
            },
          },
        },
      });

      return {
        success: true,
        message: "Payment created",
        paymentId: payment.id,
        data: {
          key_id: credentials.key_id,
          order_id: payment.externalId,
          amount: payment.amount,
          currency: payment.currency,
          name: attendee.name,
          email: attendee.email,
          bookingId: booking.id
        },
      };
    } catch (error) {
      log.error("Error creating Razorpay payment", error);
      throw error;
    }
  },

  async update(options: PaymentOptions) {
    const { payment, bookingId } = options;

    try {
      // Mark payment as successful
      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          success: true,
        },
      });

      // Mark booking as paid and confirmed
      await prisma.booking.update({
        where: {
          id: bookingId,
        },
        data: {
          paid: true,
          status: BookingStatus.ACCEPTED,
        },
      });

      // Handle successful payment and send emails, etc.
      await handlePaymentSuccess(payment.id, bookingId);

      return {
        success: true,
        message: "Payment completed",
      };
    } catch (error) {
      log.error("Error updating payment", error);
      throw error;
    }
  },

  async refund(options: PaymentOptions) {
    const { payment } = options;

    try {
      const data = payment.data as { key_id?: string; key_secret?: string };
      
      if (!data.key_id || !data.key_secret) {
        throw new Error("No Razorpay credentials found in payment data");
      }

      // Initialize Razorpay service
      const razorpayService = new RazorpayService({
        key_id: data.key_id as string,
        key_secret: data.key_secret as string,
      });

      // Implement refund logic here using Razorpay SDK
      // This would require the payment_id from the payment data
      
      // For now, just mark the payment as refunded in our database
      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          refunded: true,
        },
      });

      return {
        success: true,
        message: "Payment refunded",
      };
    } catch (error) {
      log.error("Error refunding payment", error);
      throw error;
    }
  },

  formatPrice: (amount: number, currency: string) => {
    const convertedAmount = convertFromSmallestToPresentableCurrencyUnit(amount, currency);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
    }).format(convertedAmount);
  },
};

export default razorpayPaymentHandler;
