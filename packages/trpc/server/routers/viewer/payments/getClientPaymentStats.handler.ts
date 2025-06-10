import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Booking, Payment, Prisma } from "@prisma/client";

import prisma from "@calcom/prisma";
import { BookingStatus } from "@calcom/prisma/enums";

import type { TGetClientPaymentStatsInputSchema } from "./getClientPaymentStats.schema";

// Define the type for a single payment
type SinglePayment = Prisma.PaymentGetPayload<{}>;

// Define the type for payments - could be single or array
type PaymentData = SinglePayment | SinglePayment[];

// Define the type for bookings with included payment relationship
type BookingWithPayment = Prisma.BookingGetPayload<{
  include: {
    payment: true;
    eventType: {
      select: {
        title: true;
      }
    }
  }
}>;

// Extract a payment object safely regardless of type
function extractPayment(payment: PaymentData): SinglePayment | null {
  if (!payment) return null;
  
  // Log the payment for debugging
  console.log('Extracting payment from data:', JSON.stringify(payment).substring(0, 200) + '...');
  
  // If it's an array with items, return the first one
  if (Array.isArray(payment) && payment.length > 0) {
    console.log('Payment is an array, returning first item');
    return payment[0];
  }
  
  // If it's a single non-array object, return it directly
  if (!Array.isArray(payment) && typeof payment === 'object') {
    console.log('Payment is a single object, returning directly');
    return payment as SinglePayment;
  }
  
  console.log('Payment extraction failed, returning null');
  return null;
}

// Type guard to check if payment exists
function hasPayment(booking: BookingWithPayment): boolean {
  if (!booking || !booking.payment) return false;
  
  try {
    // Handle array of payments
    if (Array.isArray(booking.payment)) {
      return booking.payment.length > 0;
    }
    
    // Handle single payment object with necessary fields
    if (typeof booking.payment === 'object' && booking.payment !== null) {
      return true;
    }
  } catch (error) {
    console.error(`Error checking payment for booking ${booking.id}:`, error);
  }
  
  // If we got here, no valid payment was found
  return false;
}

type GetClientPaymentStatsOptions = {
  ctx: {
    user: any; // Accept any user structure that authedProcedure provides
  };
  input: TGetClientPaymentStatsInputSchema;
};

export const getClientPaymentStatsHandler = async ({ ctx, input }: GetClientPaymentStatsOptions) => {
  const { clientId, isGuest } = input;
  const { user } = ctx;

  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  let bookings: BookingWithPayment[];
  
  if (isGuest) {
    // For guest clients (identified by email)
    bookings = await prisma.booking.findMany({
      where: {
        attendees: {
          some: {
            email: clientId,
          },
        },
      },
      include: {
        payment: true,
        eventType: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        startTime: "desc",
      },
    });
  } else {
    // For registered users
    const userId = parseInt(clientId, 10);
    
    if (isNaN(userId)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid client ID" });
    }
    
    bookings = await prisma.booking.findMany({
      where: {
        userId: userId, // User who made the booking
      },
      include: {
        payment: true,
        eventType: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        startTime: "desc",
      },
    });
  }

  // Process bookings into payment history
  // Each payment entry will include booking details and payment status
  const paymentHistory = bookings
    .filter(hasPayment) // Using type guard to filter bookings with payments
    .map((booking) => {
      // Extract payment data safely using our helper
      const paymentData = extractPayment(booking.payment as PaymentData);
      
      // Skip if no valid payment data was extracted (should never happen due to filter)
      if (!paymentData) {
        console.warn(`Unexpected: No payment data for booking ${booking.id} despite passing filter`);
        return null;
      }
      
      // Log payment data for debugging (only in development)
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Processing payment for booking ${booking.id}:`, {
          paymentId: paymentData.id,
          paymentType: (paymentData.data as any)?.type || 'unknown',
          success: paymentData.success,
          bookingStatus: booking.status
        });
      }
      
      return {
        id: paymentData.id,
        bookingId: booking.id,
        amount: paymentData.amount,
        currency: paymentData.currency || "INR",
        status: paymentData.success ? "paid" : "pending",
        date: booking.startTime,
        serviceName: booking.eventType?.title || booking.title || "Booking",
        bookingStatus: booking.status,
        paymentType: (paymentData.data as any)?.type || 'standard',
      };
    })
    .filter((payment): payment is NonNullable<typeof payment> => payment !== null); // Remove any null entries

  // Calculate summary statistics
  const summary = {
    totalCollected: 0,
    totalPending: 0,
    currency: paymentHistory.length > 0 ? paymentHistory[0].currency : "INR",
  };

  // Calculate totals from the processed payment history
  for (const payment of paymentHistory) {
    if (payment.status === "paid") {
      summary.totalCollected += payment.amount;
    } else {
      summary.totalPending += payment.amount;
    }

    // Warn about mixed currencies (simplistic approach)
    if (payment.currency !== summary.currency) {
      console.warn(`Mixed currencies detected for client ${clientId}`);
    }
  }

  return {
    summary,
    paymentHistory,
  };
};

export default getClientPaymentStatsHandler;
